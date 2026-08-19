-- Advance the NFL phase from certified results and print a Dispatch receipt.
begin;

create or replace function public.advance_nfl_postseason_phase() returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_next integer:=19;
  v_completed integer;
  v_label text;
  v_headline text;
  v_deck text;
begin
  if new.winners ? 'AFC-WC-2-7' and new.winners ? 'AFC-WC-3-6' and new.winners ? 'AFC-WC-4-5'
     and new.winners ? 'NFC-WC-2-7' and new.winners ? 'NFC-WC-3-6' and new.winners ? 'NFC-WC-4-5' then
    v_next:=20; v_completed:=19; v_label:='Wild Card Weekend';
    v_headline:='WILD CARD WEEKEND IS IN THE FILE';
    v_deck:='Six winners survived. The bracket has reseeded and the one-seeds are entering the room.';
  end if;
  if new.winners ? 'AFC-DIV-1' and new.winners ? 'AFC-DIV-2'
     and new.winners ? 'NFC-DIV-1' and new.winners ? 'NFC-DIV-2' then
    v_next:=21; v_completed:=20; v_label:='Divisional Round';
    v_headline:='THE FINAL FOUR ARE STILL STANDING';
    v_deck:='The Divisional Round is certified. Two conference titles now control the road to the Super Bowl.';
  end if;
  if new.winners ? 'AFC-CONF' and new.winners ? 'NFC-CONF' then
    v_next:=22; v_completed:=21; v_label:='Conference Championships';
    v_headline:='TWO CHAMPIONS. ONE GAME LEFT.';
    v_deck:='The AFC and NFC have chosen their representatives. The final receipt belongs to the Super Bowl.';
  end if;
  if new.winners ? 'SUPER-BOWL' then
    v_next:=23; v_completed:=22; v_label:='Super Bowl';
    v_headline:='THE SUPER BOWL RECEIPT IS PERMANENT';
    v_deck:='The Final Thirteen is complete. Every bracket has been scored and the champion is on file.';
  end if;

  update public.leagues
  set current_week=greatest(current_week,v_next)
  where id=new.league_id and sport_id='nfl';

  if v_completed is not null then
    insert into public.gazette_editions(league_id,week_number,week_label,volume_label,payload)
    values(
      new.league_id,
      v_completed,
      v_label,
      'NFL Postseason',
      jsonb_build_object(
        'weekIndex',v_completed,
        'weekLabel',v_label,
        'volumeLabel','NFL Postseason',
        'coverageLine',v_label||' · official results certified',
        'masthead','THE WAR ROOM DISPATCH',
        'tagline','Every Sunday leaves a receipt',
        'sportId','NFL',
        'stampLine','POSTSEASON FINAL',
        'eventLine',v_headline,
        'sideStories',jsonb_build_array(jsonb_build_object(
          'kicker','NFL POSTSEASON COMMAND',
          'headline',v_headline,
          'body',v_deck
        ))
      )
    )
    on conflict(league_id,week_number) do update
      set week_label=excluded.week_label,
          volume_label=excluded.volume_label,
          payload=excluded.payload;
  end if;
  return new;
end
$function$;

revoke all on function public.advance_nfl_postseason_phase() from public,anon,authenticated;

drop trigger if exists advance_nfl_postseason_phase on public.nfl_postseason_results;
create trigger advance_nfl_postseason_phase
after insert or update of winners on public.nfl_postseason_results
for each row execute function public.advance_nfl_postseason_phase();

commit;

