import type { ReactNode } from "react";

type PuzzleIndexIconProps = {
  slug: string;
  title: string;
};

const puzzleNames: Record<string, string> = {
  wordle: "Wordle",
  connections: "Connections",
  strands: "Strands",
  "spelling-bee": "Spelling Bee",
  "letter-boxed": "Letter Boxed",
  sudoku: "Sudoku",
  pips: "NYT Pips",
  contexto: "Contexto",
  letroso: "Letroso",
  "linkedin-zip": "LinkedIn Zip",
  "linkedin-crossclimb": "LinkedIn Crossclimb",
  "linkedin-queens": "LinkedIn Queens",
  "linkedin-tango": "LinkedIn Tango",
  "linkedin-mini-sudoku": "LinkedIn Mini Sudoku"
};

export function puzzleCardName(slug: string, title: string) {
  return puzzleNames[slug] ?? title.replace(/^Today's\s+/i, "").replace(/\s+Answer$/i, "");
}

export function PuzzleIndexIcon({ slug, title }: PuzzleIndexIconProps) {
  const name = puzzleCardName(slug, title);

  switch (slug) {
    case "connections":
      return <ConnectionsIcon title={name} />;
    case "contexto":
      return <ContextoIcon title={name} />;
    case "letroso":
      return <LetrosoIcon title={name} />;
    case "letter-boxed":
      return <LetterBoxedIcon title={name} />;
    case "sudoku":
      return <SudokuIcon title={name} />;
    case "pips":
      return <PipsIcon title={name} />;
    case "spelling-bee":
      return <SpellingBeeIcon title={name} />;
    case "strands":
      return <StrandsIcon title={name} />;
    case "wordle":
      return <WordleIcon title={name} />;
    case "linkedin-zip":
      return <ZipIcon title={name} />;
    case "linkedin-crossclimb":
      return <CrossclimbIcon title={name} />;
    case "linkedin-queens":
      return <QueensIcon title={name} />;
    case "linkedin-tango":
      return <TangoIcon title={name} />;
    case "linkedin-mini-sudoku":
      return <MiniSudokuIcon title={name} />;
    default:
      return <GenericPuzzleIcon title={name} />;
  }
}

function SvgShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 160 120" role="img" aria-label={`${title} icon`} className="h-full w-full overflow-visible">
      {children}
    </svg>
  );
}

function ConnectionsIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="13" y="7" width="134" height="106" rx="14" className="fill-background stroke-foreground" strokeWidth="7" />
      <rect x="18" y="13" width="57" height="26" className="fill-[#b46cca]" />
      <rect x="82" y="13" width="25" height="26" className="fill-background" />
      <rect x="114" y="13" width="28" height="26" className="fill-[#b46cca]" />
      <rect x="18" y="46" width="89" height="26" className="fill-[#b46cca]" />
      <rect x="114" y="46" width="28" height="26" className="fill-background" />
      <rect x="18" y="79" width="27" height="26" className="fill-background" />
      <rect x="52" y="79" width="90" height="26" className="fill-[#b46cca]" />
      <path d="M78 8v104M110 8v104M14 42h132M14 75h132" className="stroke-foreground" strokeWidth="7" />
    </SvgShell>
  );
}

function ContextoIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="18" y="7" width="124" height="106" rx="7" className="fill-[#08111d]" />
      <text x="80" y="43" textAnchor="middle" className="fill-white text-[19px] font-black tracking-wide">CONTEXTO</text>
      <rect x="30" y="58" width="100" height="16" rx="6" className="fill-[#10d898]" />
      <rect x="30" y="80" width="78" height="16" rx="4" className="fill-[#f47f3f]" />
      <rect x="30" y="102" width="55" height="14" rx="4" className="fill-[#f51d72]" />
      <rect x="114" y="95" width="18" height="18" rx="3" className="fill-[#ffdf25]" />
      <text x="123" y="110" textAnchor="middle" className="fill-[#08111d] text-[17px] font-black">AI</text>
    </SvgShell>
  );
}

function LetrosoIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="18" y="7" width="124" height="106" rx="14" className="fill-background stroke-foreground" strokeWidth="5" />
      <rect x="29" y="18" width="31" height="23" rx="4" className="fill-[#25c463]" />
      <rect x="69" y="18" width="31" height="23" rx="4" className="fill-[#f5c517]" />
      <rect x="109" y="18" width="21" height="23" rx="4" className="fill-[#41416f]" />
      <rect x="29" y="51" width="28" height="23" rx="4" className="fill-[#41416f]" />
      <rect x="68" y="51" width="62" height="23" rx="12" className="fill-[#27c665]" />
      <rect x="29" y="84" width="101" height="20" rx="10" className="fill-[#27c665]" />
    </SvgShell>
  );
}

function LetterBoxedIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="32" y="13" width="96" height="94" className="fill-[#ef2447]" />
      <path d="M32 13h96v94H32zM38 98 122 31M35 41 84 16M36 84l98-31M88 110l27-92" className="stroke-foreground" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" />
      <path d="M41 96 63 75 75 82 111 52 121 63 88 108z" className="fill-background" />
      <path d="M64 20 122 20 111 52 75 82 39 91z" className="fill-[#f07d80] opacity-75" />
    </SvgShell>
  );
}

function SudokuIcon({ title }: { title: string }) {
  const cells = [
    [22, 14], [57, 14], [127, 14], [22, 49], [92, 49], [127, 84], [57, 84]
  ];
  return (
    <SvgShell title={title}>
      <rect x="15" y="8" width="130" height="104" rx="13" className="fill-foreground" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="29" height="29" className="fill-background" />)}
      <path d="M54 9v102M89 9v102M124 9v102M16 43h128M16 78h128" className="stroke-background" strokeWidth="5" />
    </SvgShell>
  );
}

function PipsIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="20" y="10" width="120" height="100" rx="13" className="fill-[#d6afd2] stroke-foreground" strokeWidth="4" />
      <g transform="translate(80 60) rotate(-45)">
        <rect x="-39" y="-18" width="78" height="36" rx="7" className="fill-background stroke-foreground" strokeWidth="5" />
        <path d="M0-18v36" className="stroke-foreground" strokeWidth="4" />
        <circle cx="-23" cy="-7" r="3.2" className="fill-foreground" />
        <circle cx="-11" cy="7" r="3.2" className="fill-foreground" />
        <circle cx="13" cy="-8" r="3.2" className="fill-foreground" />
        <circle cx="25" cy="0" r="3.2" className="fill-foreground" />
        <circle cx="13" cy="8" r="3.2" className="fill-foreground" />
      </g>
    </SvgShell>
  );
}

function SpellingBeeIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="18" y="10" width="124" height="100" rx="13" className="fill-[#f8dc32] stroke-foreground" strokeWidth="4" />
      <ellipse cx="76" cy="63" rx="28" ry="25" className="fill-[#f8dc32] stroke-foreground" strokeWidth="5" />
      <path d="M69 41v43M83 41v43" className="stroke-foreground" strokeWidth="5" />
      <path d="M62 41c-19-11-29 1-20 17 12 5 24 2 31-10M89 41c18-13 32-1 22 16-12 6-25 3-33-9" className="fill-background stroke-foreground" strokeWidth="5" />
      <circle cx="97" cy="64" r="3" className="fill-foreground" />
      <path d="M48 70h-13" className="stroke-foreground" strokeWidth="5" strokeLinecap="round" />
    </SvgShell>
  );
}

function StrandsIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="18" y="10" width="124" height="100" rx="12" className="fill-background stroke-foreground" strokeWidth="4" />
      <path d="M36 89 56 52 78 88 102 31 124 84" className="fill-none stroke-[#f4c400]" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 89 56 52 78 88 102 31 124 84" className="fill-none stroke-foreground" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {[[36, 89], [56, 52], [78, 88], [102, 31], [124, 84]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="9" className="fill-background stroke-foreground" strokeWidth="4" />
      ))}
    </SvgShell>
  );
}

function WordleIcon({ title }: { title: string }) {
  const cells = [
    [23, 16, "fill-background"], [63, 16, "fill-background"], [103, 16, "fill-background"],
    [23, 52, "fill-background"], [63, 52, "fill-[#d6bd45]"], [103, 52, "fill-[#78a86b]"],
    [23, 88, "fill-[#78a86b]"], [63, 88, "fill-[#78a86b]"], [103, 88, "fill-[#78a86b]"]
  ];
  return (
    <SvgShell title={title}>
      <rect x="16" y="9" width="128" height="104" rx="13" className="fill-background stroke-foreground" strokeWidth="4" />
      {cells.map(([x, y, fill]) => <rect key={`${x}-${y}`} x={x as number} y={y as number} width="33" height="24" className={`${fill} stroke-foreground`} strokeWidth="4" />)}
    </SvgShell>
  );
}

function ZipIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="18" y="10" width="124" height="100" rx="13" className="fill-[#e8f1ff] stroke-foreground dark:fill-[#101826]" strokeWidth="4" />
      <path d="M38 84 58 35 82 66 104 32 124 82" className="fill-none stroke-[#2867b2]" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      {[[38, 84, 1], [58, 35, 2], [82, 66, 3], [104, 32, 4], [124, 82, 5]].map(([x, y, label]) => (
        <g key={label}>
          <circle cx={x} cy={y} r="12" className="fill-background stroke-[#2867b2]" strokeWidth="4" />
          <text x={x} y={(y as number) + 5} textAnchor="middle" className="fill-foreground text-[13px] font-black">{label}</text>
        </g>
      ))}
    </SvgShell>
  );
}

function CrossclimbIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="20" y="10" width="120" height="100" rx="13" className="fill-background stroke-foreground" strokeWidth="4" />
      {["CLUE", "CLIMB", "CRUMB", "CROSS"].map((word, index) => (
        <g key={word}>
          <rect x={36 - index * 2} y={20 + index * 22} width={88 + index * 4} height="17" rx="6" className={index === 2 ? "fill-[#f5c517]" : "fill-[#dce7f5] dark:fill-[#243042]"} />
          <text x="80" y={33 + index * 22} textAnchor="middle" className="fill-foreground text-[12px] font-black tracking-widest">{word}</text>
        </g>
      ))}
      <path d="M43 28v76M117 28v76" className="stroke-foreground" strokeWidth="4" strokeLinecap="round" />
    </SvgShell>
  );
}

function QueensIcon({ title }: { title: string }) {
  const colors = ["#f9d773", "#8fcf93", "#a9bfea", "#d29bd4", "#f3a37d", "#78cbd4", "#f9d773", "#8fcf93", "#a9bfea"];
  return (
    <SvgShell title={title}>
      <rect x="18" y="10" width="124" height="100" rx="13" className="fill-background stroke-foreground" strokeWidth="4" />
      {colors.map((color, index) => (
        <rect key={index} x={31 + (index % 3) * 33} y={21 + Math.floor(index / 3) * 27} width="31" height="25" className="stroke-foreground" fill={color} strokeWidth="3" />
      ))}
      <text x="80" y="78" textAnchor="middle" className="fill-foreground text-[42px] font-black">Q</text>
    </SvgShell>
  );
}

function TangoIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="18" y="10" width="124" height="100" rx="13" className="fill-background stroke-foreground" strokeWidth="4" />
      {Array.from({ length: 9 }).map((_, index) => (
        <rect key={index} x={32 + (index % 3) * 32} y={22 + Math.floor(index / 3) * 26} width="30" height="24" className="fill-background stroke-foreground/70" strokeWidth="3" />
      ))}
      <circle cx="47" cy="34" r="8" className="fill-[#f6c945] stroke-foreground" strokeWidth="3" />
      <path d="M87 27a8 8 0 1 0 7 13 10 10 0 1 1-7-13z" className="fill-[#5f8ed8] stroke-foreground" strokeWidth="3" />
      <circle cx="112" cy="86" r="8" className="fill-[#f6c945] stroke-foreground" strokeWidth="3" />
      <path d="M54 79a8 8 0 1 0 7 13 10 10 0 1 1-7-13z" className="fill-[#5f8ed8] stroke-foreground" strokeWidth="3" />
    </SvgShell>
  );
}

function MiniSudokuIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="20" y="10" width="120" height="100" rx="13" className="fill-background stroke-foreground" strokeWidth="4" />
      {Array.from({ length: 36 }).map((_, index) => {
        const x = 38 + (index % 6) * 14;
        const y = 21 + Math.floor(index / 6) * 14;
        const filled = [1, 8, 14, 21, 27, 34].includes(index);
        return <rect key={index} x={x} y={y} width="12" height="12" className={`${filled ? "fill-[#68b77a]" : "fill-background"} stroke-foreground/70`} strokeWidth="1.5" />;
      })}
      <path d="M80 20v85M36 63h88" className="stroke-foreground" strokeWidth="3" />
    </SvgShell>
  );
}

function GenericPuzzleIcon({ title }: { title: string }) {
  return (
    <SvgShell title={title}>
      <rect x="20" y="10" width="120" height="100" rx="13" className="fill-background stroke-foreground" strokeWidth="4" />
      <path d="M50 42h24V25h22v17h24v21H96v32H74V63H50z" className="fill-[#8ba6ff] stroke-foreground" strokeWidth="4" strokeLinejoin="round" />
    </SvgShell>
  );
}
