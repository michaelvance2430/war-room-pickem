-- Internal SECURITY DEFINER helpers are called only by other database
-- functions. They are not public RPC endpoints and need no client grant.

revoke execute on function public.museum_league_is_production(uuid)
  from authenticated;

revoke execute on function public.museum_card_first_kickoff(uuid, integer)
  from authenticated;
