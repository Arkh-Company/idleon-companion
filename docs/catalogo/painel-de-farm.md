# Painel de farm: ganhos por tempo (feature futura)

Levantado em 20/11/2026, na auditoria das marcas do catálogo.

## O insight

Nas palavras do Vinicius: "o /hr dos bonus é o que mostramos no painel de farm né. eles só entram lá. entao levante tudo que marcamos /hr e coisas que fazem sentido entrar lá e anote para uma feature futura".

Isso fecha o segundo princípio do catálogo ("entra o padronizado, não entra o que depende do alvo"):

- **O catálogo de árvores** responde "Por que meu número é esse". Ele guarda os números padronizados: os multis, as velocidades, as chances e os stats que puxam o ganho.
- **O painel de farm** responde "Quanto ganho jogando". Ele mostra o ganho por tempo (por hora, por dia, por minuto) do que está sendo feito agora.

## O que já existe

A faixa de farm do app (`src/main/farm.ts` e `src/renderer/FarmStrip.tsx`, spec 008 FR-028) mede XP, ouro e itens por hora do personagem ativo. Ela usa só a diferença entre leituras, sem fórmula, e só no combate (pausa na cidade).

A feature futura estenderia isso aos sistemas abaixo. Fica a decidir, por número, se o painel MEDE a diferença ou CALCULA pela fórmula do jogo. Quando calcular, a árvore do ganho mostra como fonte os números padronizados do catálogo.

## 1. Ganhos por tempo que vão para o painel (60)

Saíram do catálogo em 20/11: os 33 que estavam "sim" viraram "não".

| Onde       | Sistema                     | Número                                                                          | Marca antes de 20/11 |
| ---------- | --------------------------- | ------------------------------------------------------------------------------- | -------------------- |
| W1         | Smithing                    | Materials produced per hour (each material) (`anvil-items-per-hour`)            | não                  |
| W1         | Smithing                    | Bars per hour (each Forge slot) (`forge-bars-per-hour`)                         | não                  |
| W1         | Mining                      | ORES/HR (`mining-per-hr`)                                                       | sim                  |
| W1         | Mining                      | EXP/HR (`mining-exp-hr`)                                                        | sim                  |
| W1         | Mining                      | MONEY/HR (`mining-money-hr`)                                                    | não                  |
| W1         | Choppin                     | LOGS/HR (`chop-per-hr`)                                                         | sim                  |
| W1         | Choppin                     | EXP/HR (`chop-exp-hr`)                                                          | sim                  |
| W1         | Choppin                     | MONEY/HR (`chop-money-hr`)                                                      | não                  |
| W2         | Fishing                     | CATCHES/HR (`fishing-per-hr`)                                                   | sim                  |
| W2         | Fishing                     | EXP/HR (`fishing-exp-hr`)                                                       | sim                  |
| W2         | Fishing                     | MONEY/HR (Fishing) (`fishing-money-hr`)                                         | não                  |
| W2         | Catching                    | Bugs/HR (`catching-per-hr`)                                                     | sim                  |
| W2         | Catching                    | EXP/HR (`catching-exp-hr`)                                                      | sim                  |
| W2         | Catching                    | MONEY/HR (Catching) (`catching-money-hr`)                                       | não                  |
| W2         | Alchemy                     | Alchemy EXP per hour (`alch-exp-hr`)                                            | sim                  |
| W2         | Alchemy                     | Kruk Bubbles Daily (`alch-kruk-daily`)                                          | sim                  |
| W2         | Post Office                 | Daily POboxes (`post-daily-boxes`)                                              | não                  |
| W2         | Arcade                      | Arcade Sec Per Ball (balls per hour) (`arcade-balls-per-hour`)                  | sim                  |
| W2         | Islands                     | Garbage per day (Trash Island "$ /DAY") (`islands-garbage-day`)                 | sim                  |
| W2         | Islands                     | Giant crystal mobs per day (Crystal Island) (`islands-crystal-mobs`)            | sim                  |
| W3         | Construction                | Construct Exp/HR (per character) (`constr-exp-hr`)                              | sim                  |
| W3         | 3D Printer                  | Printing rate (/hr, each sample slot) (`printer-rate-hr`)                       | não                  |
| W3         | Refinery                    | Salts per hour (each salt) (`refinery-salt-hr`)                                 | sim                  |
| W4         | Cooking                     | Meals per hour (per kitchen, for the meal being cooked) (`cook-meals-per-hour`) | não                  |
| W4         | Cooking                     | Cooking Mastery EXP rate (/hr) (`cook-mastery-exp-rate`)                        | sim                  |
| W4         | Cooking                     | Bonus Ladles from Efficiency (per day) (`cook-ladles-per-day`)                  | não                  |
| W4         | Breeding                    | Egg incubation time (Next In) / eggs per hour (`breed-egg-time`)                | não                  |
| W4         | Breeding                    | Territory forage speed (/hr, per territory) (`breed-forage-rate`)               | não                  |
| W5         | Sailing                     | Loot Value per trip and per hour (each boat) (`sail-loot-value`)                | não                  |
| W5         | Divinity                    | Div Pts per hr (per character and total) (`div-pts-hr`)                         | sim                  |
| W5         | Divinity                    | Divinity EXP per hour (DivPerHr_EXP) (`div-exp-hr`)                             | sim                  |
| W5         | Gaming                      | Bits per hour (garden) (`gaming-bits-hr`)                                       | não                  |
| W5         | The Hole                    | Villager EXP per hour (each villager) (`hole-villager-exp-hr`)                  | sim                  |
| W5         | The Hole                    | Bell EXP per hour (ring, ping, clean…) (`hole-bell-exp-hr`)                     | sim                  |
| W5         | The Hole                    | Harp Note Produced (`hole-harp-notes`)                                          | sim                  |
| W5         | The Hole                    | Lamp wishes per day (`hole-lamp-wishes-day`)                                    | sim                  |
| W5         | The Hole                    | Jar Production per HR (`hole-jar-production`)                                   | não                  |
| W6         | Farming                     | Crops per hour (per plot) (`farm-crops-hr`)                                     | não                  |
| W6         | Sneaking                    | Jade Coins per hour (per ninja) (`sneak-jade-hr`)                               | sim                  |
| W6         | Sneaking                    | Sneaking EXP per hour (per ninja) (`sneak-exp-hr`)                              | não                  |
| W6         | Summoning                   | Essence Gain /HR (per color) (`summ-essence-hr`)                                | sim                  |
| W7         | Outposts                    | Resource Collection Rate (/HR, per outpost) (`outposts-resource-rate`)          | sim                  |
| W7         | Outposts                    | Rank EXP rate (per outpost) (`outposts-rank-exp-rate`)                          | sim                  |
| W7         | Spelunking                  | Spelunking chapters/HR (AFK) (`spel-ores-hr`)                                   | não                  |
| W7         | Spelunking                  | Spelunking EXP/HR (`spel-exp-hr`)                                               | não                  |
| W7         | Spelunking                  | Amber daily haul (`spel-amber-daily`)                                           | não                  |
| W7         | Research                    | Research EXP/HR (`research-exp-hr`)                                             | não                  |
| W7         | Research                    | Observation research EXP rate (`research-obs-exp-rate`)                         | não                  |
| W7         | Research                    | Observation insight rate (`research-insight-rate`)                              | não                  |
| W7         | Research                    | Tiny cogs per day (`research-tiny-cogs-day`)                                    | sim                  |
| W7         | Mr. Minehead's Depth Charge | Minehead currency (/hr) (`minehead-currency-hr`)                                | sim                  |
| W7         | Sushi Station               | Bucks (/hr) (`sushi-bucks-hr`)                                                  | não                  |
| W7         | Sushi Station               | Fuel generation (`sushi-fuel-gen`)                                              | sim                  |
| W7         | Jelly Operator              | Bloodcells per day (`jelly-bloodcell-daily`)                                    | não                  |
| W7         | Luminous Menagerie          | Lumi gains rate (/hr) (`mena-lumi-hr`)                                          | sim                  |
| W7         | Coral Reef                  | Daily Coral gain (`coral-daily`)                                                | sim                  |
| Personagem | Stats                       | KILLS/HR (fighting AFK) (`stats-afk-kills-hr`)                                  | sim                  |
| Personagem | Stats                       | MONEY/HR (fighting AFK) (`stats-afk-money-hr`)                                  | sim                  |
| Personagem | Stats                       | EXP/HR (fighting AFK) (`stats-afk-exp-hr`)                                      | não                  |
| Conta      | Colosseum                   | Colosseum tickets per day (`colo-daily-tickets`)                                | sem marca            |

## 2. Clickers (4)

Pela regra dos clickers já ficam fora do catálogo. Fica a decidir se entram no painel ou se continuam só nos otimizadores.

| Onde | Sistema | Número                                                      | Marca antes de 20/11 |
| ---- | ------- | ----------------------------------------------------------- | -------------------- |
| W1   | Orion   | Feathers per second ("{/sec") (`orion-feather-rate`)        | não                  |
| W2   | Poppy   | Bluefin fish per minute (`poppy-fish-per-min`)              | não                  |
| W2   | Poppy   | Roo Catch Rate S (Shiny fish per hour) (`poppy-shiny-rate`) | não                  |
| W3   | Bubba   | Meatslice Rate (`bubba-meat-rate`)                          | não                  |

## 3. Partes do ganho que o painel pode mostrar ao abrir um ganho (38)

São valor por drop, por viagem, por kill, por armadilha ou por troca. Alguns estão "sim" no catálogo hoje. A decisão de cada um fica para quando a feature for planejada.

| Onde       | Sistema            | Número                                                                | Marca antes de 20/11 |
| ---------- | ------------------ | --------------------------------------------------------------------- | -------------------- |
| W1         | Mining             | Mining hits per hour (base) (`mining-hits-hr`)                        | não                  |
| W1         | Mining             | Ore Value Per Drop (QTY PER DROP) (`mining-value`)                    | não                  |
| W1         | Choppin            | Choppin hits per hour (base) (`chop-hits-hr`)                         | não                  |
| W1         | Choppin            | Log Value Per Drop (QTY PER DROP) (`chop-value`)                      | não                  |
| W2         | Fishing            | Fishing catches per hour (base) (`fishing-hits-hr`)                   | não                  |
| W2         | Fishing            | Fish Value Per Drop (QTY PER DROP) (`fishing-value`)                  | não                  |
| W2         | Catching           | Catching (catches per hour, base) (`catching-hits-hr`)                | não                  |
| W2         | Catching           | Bug Value Per Drop (QTY PER DROP) (`catching-value`)                  | não                  |
| W1         | Smithing           | Bars made per cycle (`forge-bars-made`)                               | não                  |
| W3         | Refinery           | Reward Pct (salts per cycle) (`refinery-reward`)                      | não                  |
| W3         | Trapping           | Critters per trap (TotalQTY) (`trap-critters`)                        | sim                  |
| W3         | Trapping           | Trapping EXP per trap (TotalEXP) (`trap-exp`)                         | sim                  |
| W3         | Trapping           | Base QTY (critters) (`trap-base-qty`)                                 | não                  |
| W3         | Worship            | Soul Rewards (`worship-soul-rewards`)                                 | sim                  |
| W3         | Worship            | Exp Rewards (`worship-exp-rewards`)                                   | sim                  |
| W5         | Sailing            | Captain EXP per trip (CaptainEXPgain) (`sail-captain-exp-gain`)       | não                  |
| W6         | Compass            | Dust per kill (base, per map) (`compass-dust-base`)                   | não                  |
| W6         | Tesseract          | Tachyons per kill (base, per map) (`tess-tachyon-base`)               | não                  |
| W6         | Grimoire           | Bones per kill (base, per map) (`grim-bones-base`)                    | não                  |
| W7         | Spelunking         | Spelunking Chapter Value (`spel-ore-value`)                           | não                  |
| W7         | Spelunking         | Spelunking hits per hour (base) (`spel-hits-hr`)                      | não                  |
| Personagem | Stats              | Hourly kill rate (base, before AFK rate) (`stats-afk-base-kill-rate`) | não                  |
| W2         | Poppy              | Fish per catch (Juicy Worm, Multihook…) (`poppy-fish-per-catch`)      | não                  |
| W5         | Gaming             | Sprout Value TOTAL (bits of each sprout) (`gaming-sprout-value`)      | não                  |
| W7         | The Clamworks      | Pearl value (`clam-pearl-value`)                                      | não                  |
| W7         | The Clamworks      | Black pearl value (`clam-black-pearl`)                                | não                  |
| W5         | The Hole           | Fountain coin value (each coin type) (`hole-fountain-currency-value`) | não                  |
| W7         | Luminous Menagerie | Transmute value (CK base, kill multi, time multi) (`mena-ck-value`)   | não                  |
| W4         | Breeding           | Genetics Per Trash Pet (`breed-genetics-per-trash`)                   | sim                  |
| W4         | Breeding           | Genes per DNA splice (GeneSpiralQTY) (`breed-genes-per-splice`)       | não                  |
| W6         | Farming            | Magic Beans per trade (`farm-beans-per-trade`)                        | sim                  |
| W5         | Gaming             | Rat currency gain (`gaming-rat-currency`)                             | sim                  |
| W5         | The Hole           | Harp string EXP gain (`hole-harp-exp`)                                | sim                  |
| W2         | Post Office        | Order rewards (points, coins, item) (`post-order-reward`)             | não                  |
| W7         | Coral Reef         | Grind time per day (`coral-grind-time`)                               | sim                  |
| W3         | 3D Printer         | Sample size (amount stored per sample) (`printer-sample-size`)        | não                  |
| W3         | Atom Collider      | Particle gain (storage overflow conversion) (`atom-particle-gain`)    | não                  |
| W5         | Divinity           | Style base Divinity and EXP per hour (`div-style-base`)               | não                  |

## 4. Velocidades e multis: ficam no catálogo (17)

Têm "/hr" no nome, mas são o stat padronizado que puxa o ganho (regras 10 e 19). As "barras que enchem" (Build Rate, Flaggy Rate, Charge Speed, Bar Fill e outras) entraram aqui por decisão dele em 20/11: são velocidade, como a Production Speed e a Total Brew Speed que aparecem nos painéis das skills. Continuam no catálogo, e o painel usa a árvore deles como fonte.

| Onde | Sistema      | Número                                                                       | Marca antes de 20/11 |
| ---- | ------------ | ---------------------------------------------------------------------------- | -------------------- |
| W1   | Smithing     | Production Speed (per hour) (`anvil-production-speed`)                       | sim                  |
| W2   | Alchemy      | Total Brew Speed (/HR) (`alch-brew-speed`)                                   | sim                  |
| W4   | Cooking      | Meal Cooking Speed (/hr, per kitchen) (`cook-meal-speed`)                    | sim                  |
| W4   | Cooking      | New Recipe Speed (fire, /hr, per kitchen) (`cook-recipe-speed`)              | sim                  |
| W5   | Sailing      | Boat Speed (/hr, each boat) (`sail-boat-speed`)                              | sim                  |
| W7   | Spelunking   | Stamina regen rate (/hr) (`spel-stamina-regen`)                              | sim                  |
| W5   | The Hole     | Monument hours per AFK hour (MonumentHRbonusPCT, MULTI) (`hole-monument-hr`) | sim                  |
| W5   | The Hole     | Harp POW per HR (`hole-harp-pow`)                                            | não                  |
| W3   | Construction | Build Rate (/HR, total of the Cog Board) (`constr-build-rate`)               | sim                  |
| W3   | Construction | Flaggy Rate (/HR) (`constr-flaggy-rate`)                                     | sim                  |
| W3   | Worship      | Charge Speed (Worship charge per hour) (`worship-charge-rate`)               | sim                  |
| W3   | Equinox      | Bar Fill Rate (`equinox-bar-rate`)                                           | sim                  |
| W2   | Alchemy      | Liquid regen rate (/HR, each liquid) (`alch-liquid-rate`)                    | sim                  |
| W2   | Alchemy      | Sigil charge rate (per character, per hour) (`alch-sigil-charge-hr`)         | sim                  |
| W5   | The Hole     | Bolaia Study Rate (per hour) (`hole-study-rate`)                             | sim                  |
| W5   | The Hole     | Bucket Fill Rate (sediment per hour) (`hole-sediment-hr`)                    | sim                  |
| W2   | Alchemy      | Brew points per hour (each cauldron) (`alch-brew-per-hour`)                  | sim                  |

## Em aberto

- Os ganhos que hoje são exceção no catálogo (o Build Rate /HR e o Flaggy Rate /HR do W3, e o Spelunking chapters/HR do W7) passam a ser só do painel.
- O MONEY/HR geral, que ele pediu no W1, e o KILLS/HR do combate AFK passam a ser só do painel. O catálogo fica com o Cash from Mobs (coin drop rate) e o Multikill, que ainda faltam.
- "Por dia" e "por hora" no mesmo painel, ou separados: decidir no brainstorming da feature.

## Aplicado em 20/11

Os ganhos da seção 1 que estavam "sim" viraram "não" no catálogo, com a nota "regra 9 nova". As velocidades da seção 4 continuam "sim".

## Voltaram para o catálogo (regra 9 refinada, 20/11)

Passaram no teste: não dependem do alvo, e o jogo não mostra um multi separado. Entram no catálogo e também podem aparecer no painel.

- **Div Pts per hr, Essence Gain /HR, Lamp wishes, Daily Coral.**
- **Kruk Bubbles Daily, Giant crystal mobs per day, Cooking Mastery EXP rate, Egg incubation time.**
- **Villager EXP/hr, Bell EXP/hr, Jar Production.**
- **Resource Collection Rate e Rank EXP rate dos Outposts.**
- **Observation insight rate, Tiny cogs/dia, Minehead currency, Fuel generation, Lumi/hr.**

O Jade por hora e o Harp Note Produced continuam fora do catálogo, porque dependem do alvo. No lugar deles entraram o Jade Coin Multi e o Harp Note Multi.

- Bonus Ladles from Efficiency (W4) também entra no catálogo (decisão dele na conferência, 20/11).
