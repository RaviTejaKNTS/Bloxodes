# Roblox gig game: concept and first playable plan

- Date: 2026-09-06
- Status: Planning draft; game development has not started
- Working label: Bloxodes gig game
- Final game name: Undecided

## Direction

Create a Roblox game about building an independent working life through gigs. Players start with a modest home, a bike, a computer, and a phone. They earn money through hands-on activities, buy equipment, qualify for new work, and gradually improve their home and opportunities.

Develop the game in a separate repository. Bloxodes provides the brand, promotional channels, and a potential source of early testers. The game has its own code, assets, development instructions, testing, and release process.

The next milestone is a small playable delivery experience within this larger concept. Additional careers depend on evidence that the first activity is enjoyable.

This document records the discussion and proposed implementation scope. It does not commit to a release date, final title, budget, or full career roster. Keep it here as the initial planning record; when the game repository exists, move the maintained plan there and leave a reference here.

## Player fantasy and core loop

The central promise is: **Start with a bike and a small home. Find your next gig and build a life on your own terms.**

The original working name was “Grind.” The revised direction emphasizes independence, opportunity, discovery, and visible progress.

1. Discover work through the home computer and phone.
2. Check the requirements and choose an available gig.
3. Travel to the job and complete an enjoyable activity.
4. Receive payment and understand how it was calculated.
5. Save for equipment or a home improvement.
6. Use new equipment to access different opportunities.

An illustrative longer-term path is bike deliveries → tools for repair work → a van for moving jobs → hauling and restoring storage-auction finds. This is one possible path, not a mandatory career ladder.

## Starting setup and interface

| Starting item | Purpose |
| --- | --- |
| Small home | Personal base and a visible record of progress. |
| Bike | Immediately qualifies the player for local delivery work. |
| Computer | Browse gig categories, apply for new types of work, inspect requirements, and review progress. |
| Phone | Receive gig notifications, accept eligible work, view directions, and confirm payment. |

The proposed interaction rule is to apply for a category of work on the computer and accept individual assignments on the phone. This preserves the home-computer idea without requiring a trip home between every delivery.

Basic work should always be available. Special gig notifications create optional opportunities; players should not have to wait for an alert to continue playing. Show locked opportunities with a clear explanation of what equipment they require.

Home decoration, equipment displays, and expanded storage are possible later features. The first home needs only enough detail to establish ownership and support the computer interaction.

## What should make it distinctive

The design hypothesis is that connected activities and meaningful equipment purchases can make the game compelling. Having many job names by itself is insufficient.

- Each activity should involve decisions or a skill the player can improve.
- Equipment should change what players can do, beyond increasing a payout multiplier.
- Progress should be visible through possessions, capabilities, and the home.
- Different careers should eventually support different preferences: exploration, precision, coordination, or buying and selling.
- Keep routine friction low: short onboarding, readable offers, fast acceptance, and clear destinations.

Storage auctions are already present in games such as [Storage Hunters: Open World](https://www.roblox.com/games/98800969324557/Storage-Hunters-Open-World). This is a comparable mechanic, not evidence that this concept is unique or that its audience is established.

## Career backlog

These are future candidates from the discussion. Equipment and gameplay details below are proposals to explore, not launch requirements.

| Activity | Possible requirement | Source of fun to test |
| --- | --- | --- |
| Delivery | Starter bike; larger vehicles for bigger jobs | Riding, shortcuts, route planning, and managing orders. |
| Buying abandoned storage units | Savings; hauling capacity for larger finds | Reading clues, valuing contents, bidding, and discovering useful items. |
| Construction | Relevant tools or equipment | Placing or assembling parts and seeing a structure take shape. |
| Hunting | Suitable hunting equipment, such as a gun | Tracking, exploration, and learning animal behavior. |
| Hospital work | Training or role qualification | Prioritizing tasks and coordinating simplified care activities. |
| Pizza chef | Access to a kitchen role | Preparing orders accurately and coordinating during busy periods. |
| Taxi | Suitable car | Navigation, pickup planning, and driving skill. |
| Repair or moving work | Tools or a van | Restoring objects or planning and transporting a load. |

Reliable gigs can fund opportunities that require an upfront investment, such as storage buying. Preserve access to basic earning opportunities so a poor purchase never prevents a player from continuing.

## First playable scope

Build one delivery gig as the first small game within the larger world. A separate unrelated minigame remains an option if learning development becomes the primary objective, but it would provide less direct evidence for this concept.

Include:

- One compact neighborhood with a pickup point and several delivery destinations.
- A controllable bike, tested early with keyboard and touch controls.
- One small home and a simple computer application interaction.
- A phone with available work, an active order, directions, and completion feedback.
- One complete pickup → ride → handoff → payment loop.
- A small set of route variations.
- One earnable upgrade that changes play, provisionally a cargo rack that unlocks carrying two orders.
- Saved money and upgrade ownership before testing return visits.
- Basic observations or events for onboarding, accepted gigs, completed deliveries, upgrades, and return sessions.

Defer the large city, additional careers, storage auctions, hunting, construction systems, property market, player trading, business ownership, extensive decoration, and paid purchases. Add cooperative mechanics after the solo activity works; the initial Roblox experience should still handle multiple players completing independent jobs correctly.

### Make the delivery itself fun

First test responsive riding and a route choice: a straightforward road versus a shorter path that takes more control. Then test whether carrying two orders creates an interesting delivery-order decision.

Avoid piling on timers, damage systems, hunger, rent, or fuel before the basic activity works. Payment is a progression reward; riding and making delivery decisions must provide enjoyment during the job.

The introductory session should help players accept and finish a delivery quickly, understand their earnings, and see a concrete reason to take another job. Exact timings and economy values must come from playtesting.

## Build sequence and decision gates

| Stage | Deliverable | Gate before expanding |
| --- | --- | --- |
| 1. Establish the project | Separate repository, project instructions, a minimal playable scene, and a repeatable local development workflow. | The project can be opened and tested independently of Bloxodes. |
| 2. Prove the activity | Rough neighborhood, bike, pickup, route choice, handoff, and payment. | Players can control the bike and want to repeat deliveries. |
| 3. Add the gig identity | Starter home, computer application, phone, and one equipment upgrade. | Players understand how to get work and what they are earning toward. |
| 4. Run a small closed playtest | Saved progression, basic measurement, and fixes for observed problems. | Players complete the loop without coaching and some voluntarily return. |
| 5. Decide the next investment | Written findings and a revised scope. | Expand only if the activity and progression justify it. |

Build the delivery activity before spending substantial time on the home, phone presentation, or world decoration. Keep the map rough until the core interaction works.

A possible exploration boundary is four weeks of limited weekly development time. This is a proposed timebox, not a delivery estimate or an agreed allocation. Set the actual hours and budget before implementation and review progress when that allocation is used.

## Playtest questions

Recruit a small initial group, for example 10–20 Roblox players, including people who did not help design the game. Treat this as qualitative evidence; a small friendly cohort cannot establish commercial demand.

Observe:

1. Can a new player find, accept, and complete the first gig without guidance?
2. Where do players hesitate, lose control, or abandon a delivery?
3. Do they choose another job after their first payment?
4. Do they understand the upgrade and change their play after buying it?
5. Is movement comfortable on a phone?
6. Does anyone return on another day without being asked?
7. Would they still enjoy a few deliveries with all equipment already unlocked?

Record the cohort size, completed loops, session lengths, return visits, and observed friction. Avoid treating compliments as stronger evidence than actual play.

Continue if the activity is enjoyable and progression is understood. Improve the activity if players like the premise but find the work dull. Pause or rethink the concept if repeated focused revisions still require rewards or personal encouragement to keep players participating. Do not respond to a weak delivery loop by immediately adding several more careers.

## Repository and brand boundaries

| Separate game repository owns | Bloxodes repository owns |
| --- | --- |
| Game source, world assets, UI, and audio references | Website and existing applications |
| Gameplay design and economy configuration | Promotional pages and announcements |
| Player progression and game-specific persistence | Existing editorial content and website data |
| Game testing and release procedures | Website deployment and content workflows |
| Game roadmap, issues, and development instructions | Links to the game and clearly identified developer updates |

Use “A game by Bloxodes” or a similar attribution while giving the experience its own name. Select the Roblox publishing owner before public release so ownership matches the intended brand.

The game should remain playable when the Bloxodes website is unavailable. It should have its own configuration and release access, and players should not need a Bloxodes account to play. Any future website integration should solve a demonstrated need and be designed separately.

This separation fits the different product workflows and keeps game iteration from becoming part of the web deployment process. Shared branding does not require a shared runtime or repository. Keep reusable brand assets documented with their source and usage rights; avoid introducing shared packages during the prototype merely to connect the projects.

## Promotion and business approach

Use Bloxodes initially to recruit testers and explain the project. Broader promotion should follow evidence that players enjoy the experience. Label coverage of our own game clearly so readers understand the relationship.

Bloxodes may help with initial discovery, but reader-to-player conversion is unproven. Roblox's [discovery documentation](https://create.roblox.com/docs/discovery) explains the role of engagement and retention in recommendation distribution; promotion alone does not validate the gameplay.

Defer monetization design until the prototype is enjoyable. Cosmetics for the home or equipment are possible later options. Revenue forecasts, paid acquisition, and a live update schedule require separate planning after the playtest.

## Open decisions

- Final name: “Next Gig” and “On My Own” are early ideas; availability has not been checked.
- Repository name and publishing owner.
- Weekly time allocation, spending limit, and who contributes art or audio.
- Visual style and intended player audience.
- Bike handling and the one upgrade to include in the first playtest.
- Whether the second activity should be moving, repairs, or storage buying, based on player feedback and reusable mechanics.

The immediate next action is to establish the separate game project and prototype one satisfying bike delivery. The broader life-and-gigs concept remains the direction that prototype will test.
