export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BaseShape {
  id: number;
  type: string;
  color: string;
  thickness: number;
  visible: boolean;
  selected: boolean;
  label: string;
  showLabel: boolean;
}

export interface PointShape extends BaseShape {
  type: 'point';
  x: number;
  y: number;
  showGuides?: boolean;
  /** Opt out of the map-wide divided circle for this point. */
  hideDial?: boolean;
}

/** Map-wide divided circle drawn around every point (see shapes.ts normalizeDial). */
export interface DialSettings {
  show: boolean;
  /** Number of sectors (2–360). */
  divisions: number;
  /** True → a sector is centred on north; false → a sector boundary lies on north. */
  centered: boolean;
  /** Numbers from 0 / from 1, A–Z looping, A–Z0–9 looping. */
  labels: 'num0' | 'num1' | 'alpha' | 'alnum';
  /** The first sector sits this many sectors clockwise from the northern one. */
  offset: number;
  /** 'screen' → same size at any zoom; 'map' → scales with the map, can be zoomed in on. */
  size: 'screen' | 'map';
  /** Radius in screen px, used when size is 'screen'. */
  radius: number;
  /** Radius in map (image) px, used when size is 'map'. */
  mapRadius: number;
}

export interface SegmentShape extends BaseShape {
  type: 'segment' | 'median';
  p1: Point;
  p2: Point;
}

export interface LineShape extends BaseShape {
  type: 'line' | 'bisector';
  p1: Point;
  p2: Point;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
  center: Point;
  radius: number;
}

export interface TriangleShape extends BaseShape {
  type: 'triangle';
  p1: Point;
  p2: Point;
  p3: Point;
}

export interface AngleShape extends BaseShape {
  type: 'angle';
  p1: Point;
  vertex: Point;
  p2: Point;
}

export type Shape = PointShape | SegmentShape | LineShape | CircleShape | TriangleShape | AngleShape;
