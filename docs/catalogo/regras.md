# Regras do catálogo de árvores (atualizadas na auditoria, 20/11/2026)

Decididas pelo Vinicius a partir das marcações do W1 ao W7 e da auditoria das marcas. **Este arquivo é a versão em vigor.** As regras decidem o que entra no catálogo de árvores, mundo por mundo. Os números e as marcas estão em [numeros.json](numeros.json).

Os números das regras não mudam: cada uma é citada pelo número em outras notas. Por isso as regras são escritas como "- **N.**" e não como lista numerada, que o formatador renumera.

**Para que o app serve, nas palavras dele:** "Por que meu número é esse" e "Quanto ganho jogando".

- O **catálogo de árvores** responde "Por que meu número é esse".
- O **painel de farm** responde "Quanto ganho jogando". É uma feature futura; a lista do que vai para ele está em [painel-de-farm.md](painel-de-farm.md).

**Primeiro princípio (W3):** entra o número que VÁRIAS fontes formam, quando há segredo e uma conta escondida. Não entra o número de uma fonte só, nem o que o jogador já entende de olhar.

**Segundo princípio (auditoria, 20/11):** entra o número PADRONIZADO do personagem ou da conta, que vale igual em qualquer alvo. Não entra o que muda conforme o que se está coletando ou enfrentando: a pedra, a árvore, o peixe, o bicho, o mapa.

- Nas palavras dele: "o principal é sempre o multi. o exp per hr […] só existe se eu to coletando algo e depende do que ta sendo coletado".
- Exemplo: no painel do Mining entram Efficiency, Speed, Multi-Ore e o EXP Multiplier. O EXP/HR e o ORES/HR não entram.

**Terceiro princípio (auditoria, 20/11):** o ganho por tempo vai para o painel de farm, e não para o catálogo. Nas palavras dele: "o /hr dos bonus é o que mostramos no painel de farm né. eles só entram lá".

## Não entram

- **1. Custo de upgrade.**
  - O redutor de custo de uma fonte só também não entra, porque aparece dentro do redutor do sistema. Exemplos: o Darts dentro do Vault, o Cost Cruncher.
  - **O redutor total de um sistema com várias fontes ENTRA**, como o do Atom Collider, que tem 8 fontes. (Atualizada no W3.)
- **2. Contagem, nível e quantidade.** Exemplos: o nível de um stamp, os Gilded Stamps que ele tem, o nível de skill, as penas.
  - **Exceção:** a contagem que VÁRIOS sistemas aumentam ENTRA, como os Gold trimmed slots. (W3.)
- **3. Limite fixo.** O nível máximo da tabela, o máximo que só sobe pagando (o do stamp) e a capacidade de carregar.
  - **Exceção:** o limite, máximo ou mínimo, que VÁRIOS sistemas aumentam ENTRA. Exemplos: o nível máximo dos talents, o do Legend Talent, o Min Book Lv da Talent Library.
  - O limite de uma fonte só não entra, como o Shrine max level. (Atualizada no W3.)
  - **Regra de contagem (auditoria, 20/11), vale para as regras 2 e 3:** contagem e limite só entram quando 2 ou mais sistemas DE FORA os aumentam. As partes do próprio sistema (cavernas, upgrades, itens) contam como fonte só para multi, chance e stat.
    - Por isso ficam fora: Fence Yard Slots, vagas de jarro, Selector Slots, Summoning doublers, Sprout Max Evo, Gambit Points e o Max LV de Kunai/Gloves/Nunchaku/Gemstones.
    - Exceções: o Temple extra torches entra (escolha dele); o Attempt stack cap do Emperor entra; as rolagens da Research ficam fora.
- **4. O bônus ou o ganho de cada item de uma família.** Exemplos: cada stamp, cada statue, cada sign, cada bribe, o ganho de cada slot da 3D Printer. Ele aparece dentro das árvores dos stats ou do ganho.
- **5. As partes de um ganho ou de um stat que já tem árvore.**
  - Exemplos: os hits por hora de base, o QTY PER DROP e a base e o per Tier do Multikill. O Ore Value Per Drop continua fora (confirmado na auditoria, 20/11).
  - Entram aqui também os multiplicadores que fazem parte de um ganho ou de uma velocidade com árvore: o Extra Build SPDmulti, o Extra Flaggy Ratemulti e o Shiny critters multi. (Ampliada no W3.)
- **6. O número que depende do alvo atual** (segundo princípio).
  - Exemplos: o Card Odds daquela pedra, a Mine Chance, a Chop Chance, a Survivability, o Overkill tier do mapa. O Special Craft Chance também fica de fora.
  - Também o bônus da Efficiency sobre o mapa atual: "Bonus Capture for Critters on Current Map" (Trapping) e "Bonus Souls on This Map" (Worship). Fica a Efficiency. (20/11)
  - (Ampliada na auditoria, 20/11: vale para chance, EXP e ganho.)
- **7. O EXP/HR e o EXP por alvo.**
  - Não entram em nenhuma skill: o EXP/HR, o EXP por armadilha (Trapping) e o EXP por defesa (Worship).
  - **O EXP Multiplier da skill ENTRA sempre**, porque é o número padronizado.
  - (Reescrita na auditoria, 20/11. Antes dizia o contrário para as skills com EXP/HR.)
- **8. O total por stat de um sistema** (o total dos Stamps no Drop Rate, por exemplo). Ele aparece dentro da árvore do stat. Se um stat não tem árvore, o certo é dar árvore ao stat, e não ao total.
- **9. O ganho por tempo: por hora, por dia, por minuto** (terceiro princípio, 20/11). Vai para o painel de farm, uma feature futura.
  - A lista está em [painel-de-farm.md](painel-de-farm.md). São 60 ganhos, e os 33 que estavam "sim" viraram "não" em 20/11.
  - **Refinada no mesmo dia: o ganho por tempo ENTRA quando é a velocidade que o jogo mostra.** Para isso ele precisa passar nos dois testes:
    - não depende do alvo;
    - o jogo não mostra um multi ou uma velocidade separada que já entra no lugar dele.
    - Nas palavras dele: "é como o jogo mostra a velocidade".
    - Exemplos que entram: Div Pts per hr, Essence Gain /HR, Lamp wishes per day, Daily Coral gain.
  - **Sai** quando depende do alvo (ORES/HR, Jade por hora, que depende do andar do ninja) ou quando o jogo mostra um multi que entra no lugar (Bits/hr com o Total Bit Multi, loot/hr com o Loot Value Multi, Anvil com a Production Speed).
  - Quando sai por depender do alvo e o multi de várias fontes não aparece na tela, esse multi vira um número próprio. Exemplo: o Jade Coin Multi (W6, ~25 fontes), criado em 20/11.
  - Entra no catálogo o que puxa o ganho: as velocidades (regra 10), as chances da conta (regra 11), as capacidades (regra 12) e os multis (regra 19).
  - Antes, esta regra punha o ganho por hora no catálogo. Valia para ORES/HR, LOGS/HR, EXP/HR, o MONEY/HR geral e o ganho por dia.
- **15. Os sistemas clicker.** Já existem otimizadores só para eles: Poppy, The Clamworks, Orion e Bubba. O Mr. Minehead's Depth Charge saiu da lista no W7 (20/11).
- **16. O número simples, sem segredo.** É o número que o jogador já entende, ou que vem de uma fonte só. Exemplos: o loot da party (quanto mais membros, mais loot, até o máximo), o multiplicador de uma constante mais uma fonte (Shimmer, Onyx, Zenith).
- **17. O sim ou não da tela.** Exemplos: "unlocked", "perma unlock available". Não é número. (Nova, W3.)
- **18. O número que só vale dentro de uma luta ou de um minigame.** Exemplos: os stats das torres e a Skull Currency do Worship, os Minigame Reward Multi. (Nova, W3.)

## Entram

- **10. Os stats que puxam o ganho.** Exemplos: Efficiency, Speed, AFK Gains Rate, Prowess, Forge Speed, Production Speed, Brew Speed, Boat Speed, o Multikill total.
  - **As "barras que enchem" são velocidade e ficam aqui** (decidido em 20/11, olhando os painéis das skills): Build Rate /HR, Flaggy Rate /HR, Charge Speed do Worship, Bar Fill Rate do Equinox, Liquid regen, Sigil charge, Bolaia Study Rate, Bucket Fill Rate e Brew points por caldeirão.
- **11. A chance que é um stat da conta, aumentada por vários sistemas.** Exemplos: Multi-Ore, Multi-Log, Card Drop Chance, Gilded Stamp Chance. O exemplo Multi-Bars está em dúvida: o inventário diz que vem só do nível do upgrade.
- **12. A capacidade de produção**, que é o limite que trava o ganho. Exemplos: a Production capacity da Anvil, a MAX ORE CAPACITY da Forge, o Max Charge do Worship.
- **13. O multiplicador próprio de um sistema que junta VÁRIOS sistemas**, e que não é parte de um ganho com árvore (regra 5). Exemplos: Seraph Cosmos, o Exalt Bonus (Stamp Doubler).
- **19. Quando o ganho é uma base simples vezes um multiplicador com muitas fontes, entra o MULTIPLICADOR.** O segredo está no multi, e o ganho vai para o painel de farm (regra 9).
  - Exemplos: o Total Bit Multi (e não Bits/hr), o Loot Value Multi (e não o loot por hora), o Jar Rupie Value e o Fountain currency multi.
  - Valem também os multis de Dust, Tachyons e Bones. (Nova, W5.)
- **20. Masterclass (as formas Tempest, Arcanist e Wraith): os stats de combate da forma e as chances de drop dela ENTRAM, mesmo com uma fonte só.** Elas fogem da regra normal (Vinicius, no Compass, 20/11).
  - Exemplos: Tempest damage, HP, defence, crit e os stats menores; drop bonus, drop chances e Novadust chance.
  - Não entram a linha de upgrade por tier (Weapon extra power) nem os índices.

## Exceções isoladas

- **Summoning:** dos Unit stats só entra o Damage ("eu preciso só do dmg"), e o Spike damage entra. Os outros números da batalha continuam fora (regra 18).
- **Emperor:** o Attempt stack cap entra.
- **Personagem (20/11):**
  - A **Golden Food quantity** entra (exceção à regra 2): é a base do bônus de cada Golden Food.
  - O **Talent cooldown reduction** entra.
  - MP regen e Auto-Respawn time ficam fora.
  - O Max card stars e as vagas de Inventory e de Filter ficam fora, como exceções isoladas.
  - Testei uma regra a partir deles ("compra e liberação única não contam como fonte de limite") e ela NÃO vale. Na conferência de 20/11 ele manteve "sim" nos 11 limites que ela tiraria: Extra Max Lv, Upg Max LV do Equinox, Cooking Mastery points, Monument max time, Exotic purchases e Exotic level qty, Stamp doublers total, Legend Talent Max LV, Magnifiers, Friend Bonus Slots e o Attempt stack do Emperor.
  - Compra e liberação única continuam contando como fonte.
- **Carga (20/11):** entra o **multi geral de carga** (All Carry Capacity multi, no Personagem, ~7 sistemas), que vale para todo material. A capacidade de cada material continua fora: ela depende do material (segundo princípio) e é a capacidade de carregar da regra 3.
- **W3, Trimmed Slot Speed:** entra, mesmo multiplicando o Build Rate. É o multiplicador próprio do slot dourado: "em um slot normal o build rate é X, em um trimmed é x * y. quero saber o Y" (auditoria, 20/11).
- **W5:** o Temple extra torches entra (exceção à regra de contagem) e o Fountain max coins fica fora (exceção à regra 12).
- **Chances com 2 fontes, marcadas como ele quis** (auditoria, 20/11): o Free shaker do Sushi, o New Mutant e o Rat Crown Odds ficam fora. Não houve regra nova.
- **Prisma Bubble bonus multi:** fica só no W2 (Alchemy). A cópia do Tesseract no W6 saiu (regra 14).
- **W3:** o Build Rate /HR e o Flaggy Rate /HR entravam como exceção. Desde 20/11 deixaram de ser exceção: entram pela regra 10, como velocidade. Os multis deles continuam fora (regra 5).
- **W4:** entram o Mob Damage multi e o Cape Vine multi; ficam fora a Egg capacity, o Territory forage e o Total Line Width. O Bonus Ladles from Efficiency entra (conferência de 20/11), embora seja função da Cooking Efficiency, que já entra.

## Contagem de fontes

- Cada parte grande de um sistema conta como fonte separada. Exemplo: cada caverna da The Hole (W5, Jar Enchant Chance).
- O corte é de 2 ou mais sistemas. Os casos fora disso são exceções isoladas: no W5, Selector Slots e Summoning doublers ficaram fora, e Opals entrou.

## Sem regra

- O número que nenhuma regra decide chega SEM marca. Nada recebe "não" por padrão. O objetivo é achar o padrão e criar a regra.

## Onde o número fica

- **14. No sistema da tela onde ele aparece**, mesmo que venha de outro sistema. A árvore mostra o outro sistema como fonte. Exemplo: o Exalt Bonus fica no Stamps, e a árvore dele mostra o Compass.

## Números que faltam no catálogo e já se sabe que precisam

- **Multikill total.** A base e o per Tier são partes, e ficam de fora pela regra 5, decidido no W3.
- **Cash from Mobs**, o "coin drop rate": `ArbitraryCode("MonsterCash")`. É o número padronizado por trás do MONEY/HR do combate, que agora vai para o painel de farm.
