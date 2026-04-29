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
