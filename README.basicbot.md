# BasicBot function coverage

This file lists which basicBot commands and features are implemented in this project
(BorealiseBOT) and which are still missing. Scope is based on basicBot.js in this repo.

## Implemented commands (from basicBot)

| basicBot command(s)          | BorealiseBOT status                                                 |
| ---------------------------- | ------------------------------------------------------------------- |
| help, commands               | Implemented as `!help` (aliases include commands/ajuda).            |
| ping                         | Implemented as `!ping`.                                             |
| woot                         | Implemented as `!woot`.                                             |
| kick                         | Implemented as `!kick`.                                             |
| mute, unmute                 | Implemented as `!mute` and `!unmute` (duration + reason supported). |
| ban, unban                   | Implemented as `!ban` and `!unban` (duration + reason supported).   |
| lock, unlock                 | Implemented as `!lock` and `!unlock`.                               |
| skip                         | Implemented as `!skip` (basic skip).                                |
| remove                       | Implemented as `!remove`.                                           |
| move                         | Implemented as `!move` (1-based input).                             |
| swap                         | Implemented as `!swap`.                                             |
| blacklist, bl                | Implemented as `!blacklist` with add/remove/list/info.              |
| blinfo                       | Covered by `!blacklist info` (partial).                             |
| togglebl                     | Implemented as `!togglebl`.                                         |
| timeguard                    | Implemented as `!timeguard`.                                        |
| maxlength                    | Implemented as `!maxlength`.                                        |
| motd, togglemotd             | Implemented as `!motd` and `!togglemotd`.                           |
| autowoot                     | Implemented as `!autowoot`.                                         |
| welcome                      | Implemented as `!welcome`.                                          |
| dclookup, dc                 | Implemented as `!dc` (10 min window).                               |
| sessionstats, status, uptime | Partially covered by `!stats` (basic uptime + woots).               |

## Implemented features (from basicBot)

- Auto-woot on DJ advance (configurable).
- Welcome message on user join (configurable).
- Track blacklist auto-skip (per-track list).
- Time guard auto-skip for long tracks.
- MOTD and interval messages (per song count).
- Waitlist snapshot storage for DC restore flow.

## Missing commands (from basicBot)

### Moderation / room control

- add
- forceskip, fs (separate command)
- smartskip (skip with reasons)
- lockskip
- lockdown
- lockguard
- locktimer
- cycle
- cycleguard
- cycletimer
- skippos
- meh
- historyskip
- voteskip
- togglevoteskip
- bouncer+
- filter
- deletechat
- clearchat
- commanddeletion, cmddeletion, cmddel

### AFK and activity tools

- active
- afklimit
- afkremoval
- afkreset
- afktime
- autodisable
- autoskip
- restricteta
- eta
- usercommands
- usercmdcd

### Info / links / status

- botname
- link
- jointime
- whois
- voteratio
- songstats
- source
- rules
- op
- theme
- fb
- website
- youtube
- language
- english
- emoji
- status (full detailed version)

### Fun / misc

- ba
- 8ball, ask
- cookie
- ghostbuster
- gif, giphy
- roulette
- join
- leave
- thor

### Script control (browser-only in basicBot)

- refresh
- reload
- kill
- logout
- clearlocalstorage

## Notes / differences

- BasicBot blacklist uses named lists from remote URLs. BorealiseBOT uses a local
  per-track blacklist stored in SQLite.
- BasicBot status/sessionstats commands show many toggles. BorealiseBOT currently
  exposes a smaller `!stats` output.
- BasicBot DC logic tracks per-user state in memory. BorealiseBOT restores from
  stored waitlist snapshots within a fixed window.
