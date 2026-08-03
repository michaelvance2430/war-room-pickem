# I’m Bored — Fun Lobbies (Practice Mode retired)

**Status:** Shipped  
**Ship:** Practice product removed from player chrome  

## Why

Practice Mode solved a developer fear (“don’t break the league”).  
Players heard: *Am I in the wrong place? Is this real chat?*

## Product

| Surface | Job |
|---------|-----|
| **League chat** (`/locker-room`) | Current week trash talk |
| **I’m Bored** (`/bored`) | Temporary fun lobby |
| Future | DMs · announcements |

No practice/live switch. No practice database as a product.

## Rooms

Happy Hour · Trash Talk Arena · Morning Coffee · Meme Dumpster · Random Lobby  

## Tech

- Messages stored in `locker_messages` with prefix `WR_FUN|<roomId>|`  
- Filtered out of weekly Locker feed  
- No picks / scores / week 99 paint  

## Retired

- Practice Mode banner  
- Return to Live League  
- I’m Bored → practice picks week  
- BoredPracticeDoneModal UI  
