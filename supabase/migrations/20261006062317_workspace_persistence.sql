-- Additive persistence for the existing Web application. Existing user data is untouched.
create table public.workspace_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  context_key text not null check (context_key = 'workspace' or context_key ~ '^[a-z0-9][a-z0-9-]{0,38}/[a-z0-9_.-]{1,100}#[0-9]{1,10}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, context_key),
  unique(user_id, id)
);
create table public.workspace_documents (
  user_id uuid not null,
  context_id uuid not null,
  kind text not null check (kind in ('selection','repository','guide','chat','pr','review')),
  schema_version integer not null default 1 check (schema_version = 1),
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 2097152),
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key(user_id, context_id, kind),
  foreign key(user_id, context_id) references public.workspace_contexts(user_id,id) on delete cascade
);
create table public.workspace_operations (
  user_id uuid not null references public.app_users(id) on delete cascade,
  operation_id uuid not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, operation_id)
);
create index workspace_contexts_recent on public.workspace_contexts(user_id, updated_at desc);
create index workspace_operations_created on public.workspace_operations(created_at);
create table public.workspace_review_runs (
  id uuid primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  created_at timestamptz not null default now()
);
create index workspace_review_runs_user_created on public.workspace_review_runs(user_id, created_at desc);
alter table public.workspace_contexts enable row level security;
alter table public.workspace_documents enable row level security;
alter table public.workspace_operations enable row level security;
alter table public.workspace_review_runs enable row level security;
revoke all on public.workspace_contexts, public.workspace_documents, public.workspace_operations from public, anon, authenticated;
grant select, insert, update, delete on public.workspace_contexts, public.workspace_documents, public.workspace_operations to service_role;
revoke all on public.workspace_review_runs from public, anon, authenticated;
grant select, insert, update, delete on public.workspace_review_runs to service_role;

-- The caller is the trusted BFF: p_user_id MUST come from its verified application session.
-- Invoker permissions + service_role-only execution; no SECURITY DEFINER or public user JWT assumptions.
create function public.save_workspace_document(
  p_user_id uuid, p_scope text, p_kind text, p_content jsonb,
  p_expected_revision bigint, p_operation_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_context_id uuid;
  v_doc public.workspace_documents%rowtype;
  v_operation public.workspace_operations%rowtype;
  v_hash text;
  v_result jsonb;
begin
  if p_user_id is null or p_operation_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_scope is null or not (p_scope = 'workspace' or p_scope ~ '^[a-z0-9][a-z0-9-]{0,38}/[a-z0-9_.-]{1,100}#[0-9]{1,10}$')
    or p_kind is null or p_kind not in ('selection','repository','guide','chat','pr','review')
    or (p_kind = 'selection' and p_scope <> 'workspace')
    or p_content is null or jsonb_typeof(p_content) <> 'object' or octet_length(p_content::text) > 2097152 then
    raise exception 'Invalid workspace write' using errcode = '22023';
  end if;
  -- Serialize this user's writes, including operation-id reuse across different contexts.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  v_hash := md5(jsonb_build_array(p_scope,p_kind,p_content,p_expected_revision)::text);
  select * into v_operation from public.workspace_operations where user_id=p_user_id and operation_id=p_operation_id;
  if found then
    if v_operation.request_hash <> v_hash then
      raise exception 'Operation id reused with different content' using errcode = '22023';
    end if;
    return jsonb_set(v_operation.result, '{document,content}', p_content);
  end if;
  select id into v_context_id from public.workspace_contexts where user_id=p_user_id and context_key=p_scope;
  if v_context_id is not null then
    select * into v_doc from public.workspace_documents where user_id=p_user_id and context_id=v_context_id and kind=p_kind;
  end if;
  if coalesce(v_doc.revision,0) <> p_expected_revision then
    return jsonb_build_object('status','conflict','document',case when v_doc.revision is null then null else to_jsonb(v_doc) - 'user_id' end);
  end if;
  if v_context_id is null then
    insert into public.workspace_contexts(user_id,context_key) values(p_user_id,p_scope) returning id into v_context_id;
  end if;
  insert into public.workspace_documents(user_id,context_id,kind,content,revision)
    values(p_user_id,v_context_id,p_kind,p_content,p_expected_revision+1)
    on conflict(user_id,context_id,kind) do update set content=excluded.content,revision=excluded.revision,updated_at=now()
    returning * into v_doc;
  update public.workspace_contexts set updated_at=now() where id=v_context_id and user_id=p_user_id;
  v_result := jsonb_build_object('status','saved','document',to_jsonb(v_doc) - 'user_id');
  -- Retain only the response metadata for retries; do not duplicate large guide/chat content on every save.
  insert into public.workspace_operations(user_id,operation_id,request_hash,result) values(p_user_id,p_operation_id,v_hash,v_result #- '{document,content}');
  return v_result;
end;
$$;
revoke all on function public.save_workspace_document(uuid,text,text,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.save_workspace_document(uuid,text,text,jsonb,bigint,uuid) to service_role;
