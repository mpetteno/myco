begin;

-- Save a crop/cultivar draft as one transaction. Table/column allowlists and
-- ownership checks are enforced here, independently of the browser.
create function public.myco_save_crop_editor(
  crop_id uuid, cultivar_id uuid, expected_version bigint, expected_crop_version bigint,
  details jsonb, changes jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  crop public.plant_types; variety public.plant_cultivars;
  item jsonb; payload jsonb; loaded jsonb; source_row jsonb;
  table_name text; allowed text[]; columns_sql text; selected_sql text;
  entry_id uuid; entry_version bigint; owner_id uuid;
  owner_kind text; own boolean;
begin
  if not exists(select 1 from public.catalogue_administrators where user_id=(select auth.uid())) then
    raise exception 'Only catalogue administrators can save' using errcode='42501';
  end if;
  if crop_id is null or expected_version is null or expected_crop_version is null
     or jsonb_typeof(details) is distinct from 'object' or jsonb_typeof(changes) is distinct from 'array'
     or jsonb_array_length(changes)>1000 then
    raise exception 'Invalid crop draft' using errcode='22023';
  end if;
  select * into crop from public.plant_types where id=crop_id for update;
  if not found or crop.version<>expected_crop_version then
    raise exception 'Crop changed; refresh before saving' using errcode='40001';
  end if;
  if cultivar_id is not null then
    select * into variety from public.plant_cultivars where id=cultivar_id and plant_type_id=crop_id for update;
    if not found or variety.version<>expected_version then
      raise exception 'Cultivar changed; refresh before saving' using errcode='40001';
    end if;
    table_name := 'plant_cultivars'; owner_kind := 'cultivar'; owner_id := cultivar_id;
    allowed := array['name','notes','plant_spacing_cm','row_spacing_cm','border_distance_cm','living_mulch_enabled'];
  else
    if crop.version<>expected_version then raise exception 'Crop changed' using errcode='40001'; end if;
    table_name := 'plant_types'; owner_kind := 'plant'; owner_id := crop_id;
    allowed := array['name','notes','family_id','scientific_name','plant_spacing_cm','row_spacing_cm','border_distance_cm','living_mulch_enabled'];
  end if;
  if exists(select 1 from jsonb_object_keys(details) k where not k=any(allowed))
     or not (details ?& allowed) then
    raise exception 'Invalid detail fields' using errcode='22023';
  end if;
  select string_agg(format('%I', key),','), string_agg(format('v.%I',key),',')
    into columns_sql,selected_sql from unnest(allowed) key;
  execute format('update public.%I set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1) v) where id=$2',table_name,columns_sql,selected_sql,table_name)
    using details,owner_id;

  if exists(select 1 from jsonb_array_elements(changes) c where c->>'id' is not null group by c->>'table',c->>'id' having count(*)>1) then
    raise exception 'Duplicate draft entries' using errcode='22023';
  end if;
  for item in select jsonb_array_elements(changes) loop
    table_name := item->>'table'; payload := item->'details';
    entry_id := (item->>'id')::uuid; entry_version := (item->>'version')::bigint;
    case table_name
      when 'plant_guidance' then allowed := array['plant_type_id','cultivar_id','sun_requirement','tolerates_shade','rotation_years','organic_feed_level','feed_in_planting_hole','monthly_feed','reduce_water_before_harvest','stop_water_before_harvest','watering_notes'];
      when 'plant_depths' then allowed := array['plant_type_id','cultivar_id','planting_method','depth_cm','notes'];
      when 'companion_rules' then allowed := array['family_a_id','plant_a_id','cultivar_a_id','family_b_id','plant_b_id','cultivar_b_id','relationship','notes'];
      when 'rotation_rules' then allowed := array['current_family_id','current_plant_id','current_cultivar_id','previous_family_id','previous_plant_id','previous_cultivar_id','relationship','notes'];
      when 'plant_calendar_entries' then allowed := array['plant_type_id','cultivar_id','calendar_profile_id','activity','planting_method','notes'];
      else raise exception 'Invalid crop editor table' using errcode='22023';
    end case;
    if jsonb_typeof(payload) is distinct from 'object'
       or exists(select 1 from jsonb_object_keys(payload) k where not k=any(allowed))
       or not (payload ?& allowed) then
      raise exception 'Invalid guidance fields' using errcode='22023';
    end if;
    if table_name in ('plant_guidance','plant_depths','plant_calendar_entries') then
      own := (payload->>'plant_type_id')::uuid=crop_id and (payload->>'cultivar_id')::uuid is not distinct from cultivar_id;
    elsif table_name='rotation_rules' then
      own := payload->>(case when cultivar_id is null then 'current_plant_id' else 'current_cultivar_id' end)=owner_id::text;
    else
      own := payload->>(owner_kind || '_a_id')=owner_id::text or payload->>(owner_kind || '_b_id')=owner_id::text;
    end if;
    if own is distinct from true then raise exception 'Guidance belongs to a different entry' using errcode='23514'; end if;
    if item->>'source_id' is not null then
      execute format('select to_jsonb(t) from public.%I t where id=$1 for share',table_name) into source_row using (item->>'source_id')::uuid;
      if source_row is null or (source_row->>'version')::bigint is distinct from (item->>'source_version')::bigint then
        raise exception 'Inherited guidance changed' using errcode='40001';
      end if;
    end if;
    if entry_id is not null then
      execute format('select to_jsonb(t) from public.%I t where id=$1 for update',table_name) into loaded using entry_id;
      if loaded is null or (loaded->>'version')::bigint is distinct from entry_version then
        raise exception 'Guidance changed' using errcode='40001';
      end if;
      if table_name in ('plant_guidance','plant_depths','plant_calendar_entries') then
        own := (loaded->>'plant_type_id')::uuid=crop_id and (loaded->>'cultivar_id')::uuid is not distinct from cultivar_id;
      elsif table_name='rotation_rules' then
        own := loaded->>(case when cultivar_id is null then 'current_plant_id' else 'current_cultivar_id' end)=owner_id::text;
      else
        own := loaded->>(owner_kind || '_a_id')=owner_id::text or loaded->>(owner_kind || '_b_id')=owner_id::text;
      end if;
      if own is distinct from true then raise exception 'Cannot edit inherited guidance' using errcode='23514'; end if;
    end if;
    if coalesce((item->>'remove')::boolean,false) then
      if entry_id is null then raise exception 'Missing guidance entry' using errcode='22023'; end if;
      if table_name='plant_calendar_entries' then
        delete from public.calendar_windows where calendar_entry_id=entry_id;
        update public.calendar_profiles set notes=notes where id=(loaded->>'calendar_profile_id')::uuid;
      end if;
      execute format('delete from public.%I where id=$1',table_name) using entry_id;
    elsif table_name='plant_calendar_entries' then
      perform public.myco_save_calendar_entry(entry_id,entry_version,payload,item->'windows');
    else
      select string_agg(format('%I', key),','),string_agg(format('v.%I',key),',') into columns_sql,selected_sql from unnest(allowed) key;
      if entry_id is null then
        execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) v',table_name,columns_sql,selected_sql,table_name) using payload;
      else
        execute format('update public.%I set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1) v) where id=$2',table_name,columns_sql,selected_sql,table_name) using payload,entry_id;
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.myco_save_crop_editor(uuid,uuid,bigint,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.myco_save_crop_editor(uuid,uuid,bigint,bigint,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
