export interface SpacerProps {
  height: number;
}

export function Spacer({ height = 48 }: SpacerProps) {
  return <div style={{ height: `${height}px` }} aria-hidden="true" />;
}
