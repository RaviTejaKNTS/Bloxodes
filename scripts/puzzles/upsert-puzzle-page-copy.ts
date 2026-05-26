import "../shared/load-env";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Faq = { q: string; a: string };

type PuzzleCopy = {
  slug: string;
  seo_title: string;
  meta_description: string;
  intro_md: string;
  answer_intro_md: string;
  how_to_play_md: string;
  faq_json: Faq[];
};

const pages: PuzzleCopy[] = [
  {
    slug: "wordle",
    seo_title: "Today's Wordle Answer, Puzzle Number, and Past Solutions",
    meta_description: "Reveal today's Wordle answer, puzzle number, yesterday's answer, and a dated archive of previous Wordle solutions.",
    intro_md:
      "Wordle is a daily five-letter word puzzle where every guess gives color feedback. If the grid has stopped moving, the answer board below lets you reveal the solution one letter at a time.",
    answer_intro_md:
      "The solved row starts hidden, so you can reveal only the letters you want to check. Use the full reveal when you are done playing or need the complete answer quickly.",
    how_to_play_md:
      "Wordle gives you six guesses to find one five-letter word. After each guess, green means the letter is correct and in the right spot, yellow means the letter is in the word but in another spot, and gray means the letter is not part of the answer.\n\nStart with a word that tests common vowels and consonants. After that, treat every color as a rule for the next guess. Keep green letters fixed, move yellow letters to new positions, and avoid gray letters unless you have a strong reason to test a repeated letter.\n\nHard Mode is stricter because it forces you to use revealed clues in later guesses. Normal mode lets you test more letters, but the best solves still come from narrowing the answer with the feedback you already earned.",
    faq_json: [
      {
        q: "What do the Wordle colors mean?",
        a: "Green means the letter is correct in that exact position. Yellow means the letter appears somewhere else in the answer. Gray means the letter is not in the answer, though repeated letters can make gray feedback look confusing when the same letter appears more than once in a guess."
      },
      {
        q: "What is a good Wordle starting word?",
        a: "A strong opener usually has common vowels and useful consonants, such as S, T, R, N, L, or C. The exact word matters less than how you use the feedback afterward. A weak second guess wastes more solves than a slightly imperfect opener."
      },
      {
        q: "Can Wordle answers use repeated letters?",
        a: "Yes. Wordle answers can repeat letters. If a guess has two of the same letter, the color feedback only marks as many copies as the answer actually contains, so repeated-letter days need extra care."
      },
      {
        q: "When should I check the answer?",
        a: "Check the answer when you are out of useful guesses, when you only want to confirm the puzzle number, or when you are done protecting your streak for the day. Revealing one tile at a time is safer if you only need a small nudge."
      }
    ]
  },
  {
    slug: "connections",
    seo_title: "Today's NYT Connections Answer, Categories, and Solved Groups",
    meta_description: "Reveal today's NYT Connections answer with the original grid, color groups, category names, and an archive of previous puzzles.",
    intro_md:
      "Connections is a daily word-grouping puzzle built around 16 words and four hidden categories. The board below starts in the original grid order, then reveals each solved color group only when you choose it.",
    answer_intro_md:
      "Reveal one group at a time if you want a controlled spoiler. Yellow is usually the most direct group, while purple is often the wordplay or trickiest connection.",
    how_to_play_md:
      "Connections asks you to split 16 tiles into four groups of four. Select four words that share a theme, then submit them as a group. A correct group locks into a colored row with a category name.\n\nThe colors usually act like difficulty tiers: yellow is often straightforward, green is a little less obvious, blue can be more specific, and purple often uses wordplay, alternate meanings, or hidden patterns. That order is useful, but it is not a guarantee that everyone will find the same group easiest.\n\nGood solving starts by looking for obvious sets, then checking whether any word could belong to more than one possible category. If a group feels right but one word seems too flexible, save it for later. Connections often uses decoys, shared prefixes, homophones, pop culture sets, and words with multiple meanings.",
    faq_json: [
      {
        q: "How many groups are in Connections?",
        a: "Each daily Connections puzzle has four groups of four words. All 16 tiles belong to exactly one solved group, even if a few words look like they could fit somewhere else at first."
      },
      {
        q: "What do the yellow, green, blue, and purple groups mean?",
        a: "The colors show the solved group difficulty from easier to harder in the usual NYT order. Yellow tends to be the plainest category, and purple tends to be the trickiest or most wordplay-heavy group."
      },
      {
        q: "Why do some Connections words feel like traps?",
        a: "Connections often includes words that can point to more than one idea. A tile might fit a sports category, a phrase category, or a spelling pattern. The safest method is to prove all four words in a group before submitting."
      },
      {
        q: "What is the best way to use the answer board?",
        a: "Reveal only the color group you need. If you still want to finish the puzzle yourself, checking one group can remove a blocker without spoiling every category."
      }
    ]
  },
  {
    slug: "strands",
    seo_title: "Today's NYT Strands Answer, Spangram, Theme Words, and Solved Grid",
    meta_description: "Reveal today's NYT Strands spangram, theme words, clue, and solved grid with visual word paths.",
    intro_md:
      "Strands is a themed word-search puzzle with a daily clue, hidden theme words, and one spangram that crosses the board. The solved grid below traces each answer in the direction it appears.",
    answer_intro_md:
      "Reveal the spangram or individual theme words when you need a nudge. The animated paths show the letter order, which is often more useful than a plain word list.",
    how_to_play_md:
      "Strands gives you a grid of letters and a short theme clue. Find words that match the theme by connecting adjacent letters horizontally, vertically, or diagonally. A word path can bend, but each letter in that path must connect to the next one.\n\nThe spangram is the special answer that describes the overall theme and touches two opposite sides of the board. Finding it early can make the rest of the theme words easier because it tells you what kind of answers the puzzle wants.\n\nIf you find non-theme words, the game can build toward a hint. That hint highlights letters for an unsolved theme word, but you still need to trace the correct path. When solving without hints, scan corners and edges, look for common endings, and use the theme clue to decide whether a word is actually part of the set.",
    faq_json: [
      {
        q: "What is a Strands spangram?",
        a: "The spangram is the answer that names or explains the puzzle theme. It stretches across the board by touching two opposite sides, and it usually helps the other theme words make sense."
      },
      {
        q: "Can Strands words move diagonally?",
        a: "Yes. Letter paths can move horizontally, vertically, or diagonally as long as each letter touches the next one. Paths can also bend, which is why seeing the solved route is helpful."
      },
      {
        q: "Are non-theme words wrong?",
        a: "Non-theme words are not the final answers, but finding valid extra words can help earn hints in the game. The main solve still comes from the theme words and the spangram."
      },
      {
        q: "Why reveal the path instead of only the word?",
        a: "Strands is partly about finding how a word snakes through the grid. A plain list gives the answer, but a traced path shows the direction, turns, and board placement."
      }
    ]
  },
  {
    slug: "spelling-bee",
    seo_title: "Today's NYT Spelling Bee Answers, Pangrams, and Honeycomb Letters",
    meta_description: "Check today's NYT Spelling Bee center letter, outer letters, pangrams, and accepted answer list.",
    intro_md:
      "Spelling Bee is a seven-letter word game where every answer must use the center letter. The answer section separates pangrams from the full word list so you can check the part you care about first.",
    answer_intro_md:
      "Start with the honeycomb and pangrams if you want the big solve, then open the full list when you are ready to compare every accepted word.",
    how_to_play_md:
      "Spelling Bee gives you seven letters arranged like a honeycomb. Every answer must include the center letter, must use only the seven available letters, and must be at least four letters long. Letters can be reused, so a word can contain the same tile more than once.\n\nA pangram uses all seven letters at least once. Pangrams are worth chasing because they score more and often unlock the shape of the puzzle faster than small words. The full answer list depends on NYT's accepted dictionary for that day, so a real English word may still be rejected if it is outside the game's list.\n\nA practical method is to build from prefixes, suffixes, plurals where accepted, and common letter pairs. Keep rotating the honeycomb mentally: the same letters can produce different words once you stop reading them in the displayed order.",
    faq_json: [
      {
        q: "What is a pangram in Spelling Bee?",
        a: "A pangram is a word that uses all seven letters in the honeycomb at least once. There can be one pangram or multiple pangrams depending on the day."
      },
      {
        q: "Can I use a letter more than once?",
        a: "Yes. The seven letters are not consumed when you use them. You can repeat any available letter as long as the word includes the center letter and follows the accepted word list."
      },
      {
        q: "Why does Spelling Bee reject some real words?",
        a: "Spelling Bee uses a curated answer list. Proper nouns, hyphenated words, offensive words, and many obscure words are usually excluded, and the exact accepted list can feel stricter than a normal dictionary."
      },
      {
        q: "What is the best solving order?",
        a: "Find easy four-letter words first, then hunt for longer words using common endings. After that, focus on pangrams because they often reveal how the day's letters want to combine."
      }
    ]
  },
  {
    slug: "letter-boxed",
    seo_title: "Today's NYT Letter Boxed Answer, Board Letters, and Solution Chain",
    meta_description: "Reveal today's NYT Letter Boxed solution chain, board sides, par, and previous answers.",
    intro_md:
      "Letter Boxed is a word-chain puzzle played around a square of letters. The answer below shows the board and solution path so the chain is easier to follow than a plain list.",
    answer_intro_md:
      "The solution is shown in order because each word must start with the final letter of the previous word. Check the chain when you want to see how all sides get used.",
    how_to_play_md:
      "Letter Boxed places letters on four sides of a square. Make words by jumping from one side to another, but you cannot use two consecutive letters from the same side. Words must be at least three letters long.\n\nThe last letter of each word becomes the first letter of the next word, so the solve is a chain rather than separate guesses. The goal is to use every letter around the box, and the game gives a par number that shows how compact the intended solution is.\n\nGood Letter Boxed solving starts with awkward letters and rare endings. A long first word is useful only if its final letter can start a strong next word. If a chain keeps leaving one side untouched, rebuild from that side instead of trying to force it at the end.",
    faq_json: [
      {
        q: "What does par mean in Letter Boxed?",
        a: "Par is the target number of words for the puzzle. A par of 2 means the puzzle has a clean two-word chain, but longer chains can still solve the board if the game accepts them."
      },
      {
        q: "Can consecutive letters come from the same side?",
        a: "No. Each next letter must come from a different side of the square. That side-switching rule is the main constraint that makes the puzzle harder than a normal anagram."
      },
      {
        q: "Does every letter need to be used?",
        a: "Yes. A valid finished solution must use all letters around the box at least once across the word chain."
      },
      {
        q: "Why does the order of the solution matter?",
        a: "Every word after the first must begin with the last letter of the previous word. The same words in the wrong order may fail even if they use all the board letters."
      }
    ]
  },
  {
    slug: "sudoku",
    seo_title: "Today's NYT Sudoku Answers for Easy, Medium, and Hard",
    meta_description: "Reveal today's NYT Sudoku solved grids for Easy, Medium, and Hard puzzles.",
    intro_md:
      "NYT Sudoku is the classic 9x9 number logic puzzle offered in daily Easy, Medium, and Hard versions. Each solved grid below is separated by difficulty so you can check only the puzzle you played.",
    answer_intro_md:
      "Pick the matching difficulty before revealing a solution. Sudoku spoilers are full-grid spoilers, so avoid opening the wrong board if you are still solving.",
    how_to_play_md:
      "Sudoku starts with a 9x9 grid and some numbers already placed. Fill the empty cells with numbers 1 through 9 so that every row, every column, and every 3x3 box contains each number exactly once.\n\nThe cleanest method is elimination. Look at a row, column, or box and ask which numbers are missing. Then check crossing rows and columns to see where each missing number can still fit. Pencil marks or candidates help when a cell has more than one possible value.\n\nEasy puzzles usually fall to direct scanning. Medium and Hard puzzles need more pattern work, such as hidden singles, locked candidates, pairs, and box-line interactions. Guessing can break a grid quickly, so only branch mentally when logic has truly stalled.",
    faq_json: [
      {
        q: "What is the basic rule of Sudoku?",
        a: "Each row, column, and 3x3 box must contain the numbers 1 through 9 exactly once. No number can repeat inside any of those three areas."
      },
      {
        q: "What is the difference between Easy, Medium, and Hard?",
        a: "The rules are the same, but the amount of deduction changes. Easy puzzles usually have more direct placements, while Hard puzzles require more candidate tracking and multi-step logic."
      },
      {
        q: "Should I guess in Sudoku?",
        a: "Good Sudoku solving is mostly logic. If you guess too early, one wrong placement can poison the whole grid. Use candidates and elimination before trying a risky branch."
      },
      {
        q: "Why are solved grids useful?",
        a: "A solved grid lets you check a contradiction, compare a stuck section, or confirm the final board. It is usually better to reveal only after you have narrowed the puzzle as far as you can."
      }
    ]
  },
  {
    slug: "pips",
    seo_title: "Today's NYT Pips Answers for Easy, Medium, and Hard",
    meta_description: "Reveal today's NYT Pips solutions for Easy, Medium, and Hard domino logic boards.",
    intro_md:
      "Pips is a domino-placement logic puzzle where every board region has a condition to satisfy. The answers below keep Easy, Medium, and Hard separate because each difficulty has its own layout.",
    answer_intro_md:
      "Use the solved board when a region rule or domino placement stops making sense. The visual layout matters more than a text-only answer because orientation is part of the solve.",
    how_to_play_md:
      "Pips gives you a board, a set of dominoes, and colored regions with rules. Place every domino so the board is filled and each region's condition is satisfied. Dominoes can be rotated, so both position and orientation matter.\n\nA region may ask for a total number of pips, matching values, different values, or a greater-than or less-than condition. Blank areas usually just need to be filled legally. Harder boards combine more regions, which means one domino can affect several constraints at once.\n\nStart with the strictest regions first: exact totals, equality rules, and small spaces usually reduce the options fastest. Then use leftover dominoes to test the flexible regions. If a placement fits one rule but blocks another region completely, back it out and look for a domino that satisfies both sides of the board.",
    faq_json: [
      {
        q: "What are pips in Pips?",
        a: "Pips are the dots on a domino half. Region rules count or compare those dots, so a domino with 3 and 5 has two values that can matter separately depending on where it is placed."
      },
      {
        q: "Do all dominoes have to be used?",
        a: "Yes. A finished Pips board uses the available dominoes to fill the board while satisfying every colored region rule."
      },
      {
        q: "Why is orientation important?",
        a: "Rotating a domino changes which half lands in which cell. That can change a region's total, equality, or comparison result even when the same domino is used."
      },
      {
        q: "Which Pips difficulty should I check first?",
        a: "Check only the difficulty you played. Easy, Medium, and Hard are separate daily boards, so an answer from one difficulty will not solve another."
      }
    ]
  },
  {
    slug: "contexto",
    seo_title: "Today's Contexto Answer and Past Contexto Solutions",
    meta_description: "Reveal today's Contexto answer, yesterday's answer, and archived Contexto solutions by date.",
    intro_md:
      "Contexto is a semantic word-guessing game where closeness is about meaning, not spelling. The answer below helps when the ranking trail has gone cold.",
    answer_intro_md:
      "The answer is best used after you have tested a few meaning clusters. Contexto is more satisfying when you can see why nearby guesses were close.",
    how_to_play_md:
      "Contexto lets you guess almost any word, then ranks that guess by how semantically close it is to the secret answer. A lower rank means your word is closer in meaning. Unlike Wordle, the letters do not matter, and there is no fixed word length to infer from tile colors.\n\nA good solve starts broad. Try categories such as objects, people, places, food, actions, emotions, professions, or nature. When a guess lands close, pivot around related ideas instead of spelling variations. If `river` is close, try water, geography, travel, and natural features before worrying about synonyms only.\n\nThe main trap is treating Contexto like a dictionary synonym game. The model often rewards words that appear in similar contexts, so a related object or category can be closer than a direct synonym.",
    faq_json: [
      {
        q: "How does Contexto score guesses?",
        a: "Contexto ranks guesses by semantic closeness to the secret word. The exact model is hidden, but the useful idea is simple: lower numbers mean your guess appears closer in meaning or context."
      },
      {
        q: "Is Contexto about spelling?",
        a: "No. Letter placement, word length, and spelling patterns do not guide the solve. Contexto is about meaning, association, and nearby concepts."
      },
      {
        q: "Why can a non-synonym be close?",
        a: "Words can be semantically close because they appear in similar contexts. For example, a tool, job, place, and action can cluster together even if they are not synonyms."
      },
      {
        q: "What should I do when every guess is far away?",
        a: "Reset with broad category words. Try living things, places, materials, emotions, professions, actions, foods, and objects until one area gives you a much lower rank."
      }
    ]
  },
  {
    slug: "letroso",
    seo_title: "Today's Letroso Answer, Meaning, and Past Solutions",
    meta_description: "Reveal today's Letroso answer, meaning when available, yesterday's answer, and previous Letroso solutions.",
    intro_md:
      "Letroso is a daily word-guessing puzzle with variable word length, unlimited guesses, and more visual feedback than a normal Wordle-style grid. The answer section gives the final word and meaning when available.",
    answer_intro_md:
      "Check the answer after reading the color and shape clues as far as they can take you. The meaning can help make an unfamiliar solution feel less random.",
    how_to_play_md:
      "Letroso asks you to guess a hidden word, then gives feedback after each guess. Green letters are correct in the right place, yellow letters belong somewhere else, and gray letters are not part of the answer.\n\nThe twist is that Letroso also uses structure clues. Depending on the puzzle, connected letters can show which letters sit together in the answer, while shape or corner hints can confirm parts of the beginning or end. Because guesses are unlimited, the challenge is not survival. It is reading the feedback efficiently.\n\nStart with a word that tests common letters, then watch for confirmed clusters. If two letters are connected, build guesses that keep that pair together. If a letter is yellow, move it to a different position instead of throwing it away.",
    faq_json: [
      {
        q: "How is Letroso different from Wordle?",
        a: "Letroso has variable word lengths and unlimited guesses. It still uses color feedback, but it also adds visual clues such as connected letters and position shapes."
      },
      {
        q: "Do guesses run out in Letroso?",
        a: "No. You can keep guessing until you find the answer. The skill is solving in fewer guesses by using every clue, not simply avoiding a fail state."
      },
      {
        q: "What do connected letters mean?",
        a: "Connected letters indicate that those letters are next to each other in the final answer. Keeping those pairs together can reduce the possible word shapes quickly."
      },
      {
        q: "Why include the meaning?",
        a: "Letroso answers can be uncommon. A short meaning helps you understand the word after the solve instead of only seeing a string of letters."
      }
    ]
  },
  {
    slug: "linkedin-zip",
    seo_title: "Today's LinkedIn Zip Answer and Solved Path",
    meta_description: "Reveal today's LinkedIn Zip answer with the ordered path, numbered checkpoints, and previous solutions.",
    intro_md:
      "LinkedIn Zip is a daily path puzzle where one route has to connect the numbered checkpoints in order. The solved board shows the path through the grid instead of reducing the answer to a list.",
    answer_intro_md:
      "Use the visual path when you are stuck between two possible routes. The order matters because the path has to respect the numbered sequence.",
    how_to_play_md:
      "Zip gives you a grid with numbered checkpoints. Draw one continuous path that starts at the first number, reaches each later number in order, and covers the required open cells without breaking the path.\n\nWalls or blocked edges can force the route to bend in a specific way. The hardest part is planning ahead: a path that reaches the next number too directly may trap empty cells behind it. Good solving means keeping the board connected while still moving toward the next checkpoint.\n\nStart by connecting forced corridors and tight corners. Then look at the numbered checkpoints as anchors. If a route creates a dead end that cannot be filled later, it is usually wrong even if it reaches the next number.",
    faq_json: [
      {
        q: "What is the goal in LinkedIn Zip?",
        a: "The goal is to draw one valid path through the grid while visiting numbered checkpoints in order. The route has to obey the board's walls and layout constraints."
      },
      {
        q: "Why does the path order matter?",
        a: "The numbers are checkpoints. Reaching them out of order breaks the puzzle, even if the path visually covers a lot of the board."
      },
      {
        q: "What makes Zip difficult?",
        a: "A route can look good early and still fail because it traps cells, blocks a checkpoint, or leaves no way to finish the path. Planning the end of the path matters as much as the start."
      },
      {
        q: "Is Zip a word game?",
        a: "No. Zip is a logic and path-planning puzzle, which makes it closer to a grid maze than a vocabulary game."
      }
    ]
  },
  {
    slug: "linkedin-crossclimb",
    seo_title: "Today's LinkedIn Crossclimb Answer, Word Ladder, and Clues",
    meta_description: "Reveal today's LinkedIn Crossclimb answer with the solved word ladder, clues, and previous solutions.",
    intro_md:
      "Crossclimb is LinkedIn's clue-based word ladder. Solve the clue words, then arrange them so each neighboring rung changes by one letter.",
    answer_intro_md:
      "The solved ladder is shown in order with clues, making it easier to check the rung that broke the chain.",
    how_to_play_md:
      "Crossclimb starts with clue answers that need to become a ladder. Each rung is a word, and neighboring words differ by one letter. Once the ladder works, the top and bottom rows connect to a combo clue that completes the puzzle.\n\nSolve the clues first, even if the order is unclear. Then compare the words by letter changes. If two words differ by more than one letter, they cannot be neighbors. If several words are close, use the clue order and the top or bottom answer to decide which chain makes sense.\n\nThe best method is to treat it like a crossword and a ladder at the same time. A clue can confirm the word, but the one-letter-change rule confirms where that word belongs.",
    faq_json: [
      {
        q: "What is a word ladder in Crossclimb?",
        a: "A word ladder is a sequence where each word changes by one letter from the word before or after it. The ladder order is just as important as the individual clue answers."
      },
      {
        q: "Do clues or ladder order matter more?",
        a: "Both matter. Clues identify the words, while the ladder rule decides their order. If a clue answer does not fit the one-letter chain, recheck either the word or its placement."
      },
      {
        q: "What are the top and bottom rows?",
        a: "They are tied to the final combo clue. Solving the main ladder usually gives enough structure to unlock those extra rows."
      },
      {
        q: "Why show the clues with the answers?",
        a: "Crossclimb mistakes often happen on one rung. Seeing the clue beside the solved word makes it easier to understand which answer belongs where."
      }
    ]
  },
  {
    slug: "linkedin-queens",
    seo_title: "Today's LinkedIn Queens Answer and Solved Grid",
    meta_description: "Reveal today's LinkedIn Queens answer with queen placements, color regions, and previous solved grids.",
    intro_md:
      "LinkedIn Queens is a crown-placement logic puzzle with rows, columns, color regions, and adjacency rules. The solved grid shows exactly where each queen belongs.",
    answer_intro_md:
      "Use the board when one region is forcing the rest of the puzzle. A single queen placement can eliminate several rows, columns, and neighboring cells.",
    how_to_play_md:
      "Queens asks you to place one queen, shown as a crown, in every row, every column, and every colored region. No two queens can touch, including diagonally.\n\nThe colored regions are the key difference from normal N-Queens. A row or column may have several possible cells, but each region still needs exactly one queen. Marking impossible cells with Xs helps because one confirmed queen immediately rules out its row, column, region, and all adjacent cells.\n\nStart with tiny or awkward regions because they usually have fewer legal cells. Then look for rows or columns where every option but one has been eliminated. Good Queens solving is mostly about removing impossible cells before placing the next crown.",
    faq_json: [
      {
        q: "How many queens go in each row and column?",
        a: "Exactly one queen goes in each row and exactly one queen goes in each column. Extra queens in the same row or column break the puzzle."
      },
      {
        q: "How do colored regions work?",
        a: "Each colored region must contain exactly one queen. Region shape matters because it can force placements that normal row and column logic would not catch."
      },
      {
        q: "Can queens touch diagonally?",
        a: "No. Queens cannot be adjacent horizontally, vertically, or diagonally. Even a diagonal corner touch is invalid."
      },
      {
        q: "What is the best first move in Queens?",
        a: "Look for small regions, narrow rows, and cells that would block too many neighboring options. Marking impossible cells first is often safer than placing a crown too early."
      }
    ]
  },
  {
    slug: "linkedin-tango",
    seo_title: "Today's LinkedIn Tango Answer and Solved Sun Moon Grid",
    meta_description: "Reveal today's LinkedIn Tango answer with the solved sun and moon grid, constraints, and previous solutions.",
    intro_md:
      "LinkedIn Tango is a binary logic puzzle played with suns and moons. The solved grid below shows the finished pattern and any relationship clues saved with the puzzle.",
    answer_intro_md:
      "Check the solved board when a row, column, or equality clue creates a contradiction. Tango is easiest to verify visually because every symbol affects nearby balance.",
    how_to_play_md:
      "Tango uses a grid filled with two symbols, usually suns and moons. Each row and column must stay balanced, so a standard 6x6 board ends with three suns and three moons in every row and column.\n\nThe other major rule is that three matching symbols cannot appear in a row horizontally or vertically. If you see two suns together with an empty cell on one side, that empty cell often has to be a moon. Relationship marks add another layer: an equals sign means two linked cells must match, while an X means they must be opposite symbols.\n\nSolve by combining balance, no-three-in-a-row logic, and the relationship marks. Guessing is risky because one wrong sun or moon can make several rows impossible at once.",
    faq_json: [
      {
        q: "What are the two symbols in Tango?",
        a: "The puzzle uses two opposite symbols, usually shown as suns and moons. The exact icon is less important than keeping the two symbol counts balanced."
      },
      {
        q: "What does the equals sign mean?",
        a: "An equals sign means the two connected cells must contain the same symbol. If one side is a sun, the other side must also be a sun."
      },
      {
        q: "What does the X mark mean?",
        a: "An X means the two connected cells must be different. If one side is a sun, the other side must be a moon."
      },
      {
        q: "Why is three in a row not allowed?",
        a: "The no-three rule prevents a row or column from filling with too many of one symbol. It is one of the fastest ways to force the next placement."
      }
    ]
  },
  {
    slug: "linkedin-mini-sudoku",
    seo_title: "Today's LinkedIn Mini Sudoku Answer and Solved Grid",
    meta_description: "Reveal today's LinkedIn Mini Sudoku solution grid, preset clues, and previous answers.",
    intro_md:
      "LinkedIn Mini Sudoku is a compact 6x6 version of classic Sudoku. The solved grid helps you check the final number pattern without mixing it up with NYT's 9x9 Sudoku.",
    answer_intro_md:
      "Reveal the solution only for the Mini Sudoku board you played. The smaller grid is quick, but one wrong digit can still break a row, column, or shaded region.",
    how_to_play_md:
      "Mini Sudoku uses a 6x6 grid and the digits 1 through 6. Fill the empty cells so each row, each column, and each shaded region contains every digit exactly once.\n\nThe shaded regions replace the familiar 3x3 boxes from classic Sudoku. That means the region shapes are part of the puzzle, not decoration. A number can be legal in a row and column but still fail because it repeats inside its shaded region.\n\nStart with rows, columns, or regions that already have several given numbers. List the missing digits, then cross-check the intersecting row and column for each empty cell. Because the grid is small, one confirmed digit often unlocks the next few placements quickly.",
    faq_json: [
      {
        q: "How is Mini Sudoku different from regular Sudoku?",
        a: "Mini Sudoku uses a 6x6 grid with digits 1 through 6 instead of a 9x9 grid with digits 1 through 9. The smaller size makes it quicker, but the logic still matters."
      },
      {
        q: "What are shaded regions?",
        a: "Shaded regions are the box-like groups for the puzzle. Each region must contain every digit exactly once, just like each row and column."
      },
      {
        q: "Can a number repeat in a row or column?",
        a: "No. Each row and each column must contain 1 through 6 exactly once, so repeats are never valid."
      },
      {
        q: "Why mark preset clues?",
        a: "Preset clues are the numbers the puzzle gives at the start. Marking them separately makes it easier to see which numbers were fixed and which were solved."
      }
    ]
  }
];

async function main() {
  const sb = supabaseAdmin();
  for (const page of pages) {
    const { slug, ...fields } = page;
    const { error } = await sb
      .from("puzzle_pages")
      .update({
        ...fields,
        description_md: ""
      })
      .eq("slug", slug);

    if (error) throw new Error(`Failed to update ${slug}: ${error.message}`);
    console.log(`[ok] ${slug}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
