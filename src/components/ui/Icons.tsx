interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function svg({ size = 14, className, strokeWidth = 2 }: IconProps, children: React.ReactNode, fill = "none") {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return svg(props, <>
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </>);
}

export function ArchiveIcon(props: IconProps) {
  return svg(props, <>
    <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
  </>);
}

export function ChevronRightIcon(props: IconProps) {
  return svg(props, <polyline points="9 18 15 12 9 6" />);
}

export function CheckIcon(props: IconProps) {
  return svg(props, <polyline points="20 6 9 17 4 12" />);
}

export function TrashIcon(props: IconProps) {
  return svg(props, <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>);
}

export function AIIcon(props: IconProps) {
  return svg(props, <>
    <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
    <line x1="9" y1="22" x2="15" y2="22" />
  </>);
}

export function SearchIcon(props: IconProps) {
  return svg(props, <>
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>);
}

export function PinIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return svg(props, <>
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z" />
  </>, filled ? "currentColor" : "none");
}

export function DownloadIcon(props: IconProps) {
  return svg(props, <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </>);
}

export function LinkIcon(props: IconProps) {
  return svg(props, <>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </>);
}

export function ExpandIcon(props: IconProps) {
  return svg(props, <>
    <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" />
  </>);
}

export function RestoreIcon(props: IconProps) {
  return svg(props, <>
    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </>);
}

export function ArrowLeftIcon(props: IconProps) {
  return svg(props, <>
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </>);
}

export function FilterIcon(props: IconProps) {
  return svg(props, <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />);
}

export function CalendarIcon(props: IconProps) {
  return svg(props, <>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </>);
}

export function FileIcon(props: IconProps) {
  return svg(props, <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </>);
}
