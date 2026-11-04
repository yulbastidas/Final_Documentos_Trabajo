export type IconName =
  | 'grid'
  | 'file'
  | 'users'
  | 'shield'
  | 'activity'
  | 'chart'
  | 'lab'
  | 'help'
  | 'arrow'
  | 'plus'
  | 'search'
  | 'download'
  | 'lock'
  | 'check'
  | 'menu';
const paths: Record<IconName, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  file: 'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h5',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',
  shield: 'M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7z M8 12l3 3 5-6',
  activity: 'M2 12h4l3-8 6 16 3-8h4',
  chart: 'M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5',
  lab: 'M9 3h6 M10 3v6L4 19q-1 2 2 2h12q3 0 2-2L14 9V3 M7 15h10',
  help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  plus: 'M12 5v14 M5 12h14',
  search: 'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  lock: 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3',
  check: 'M5 12l4 4L19 6',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
