begin;

alter table public.professionals
alter column normalized_document set not null;

alter table public.persons
alter column normalized_document set not null;

commit;
