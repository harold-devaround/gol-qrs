// @ts-nocheck
import { EventEmitter } from '../../utils/events.js';
import { SelectTool } from './select.js';
import { PointTool } from './point.js';
import { SegmentTool } from './segment.js';
import { LineTool } from './line.js';
import { CircleTool } from './circle.js';
import { TriangleTool } from './triangle.js';
import { MedianTool } from './median.js';
import { BisectorTool } from './bisector.js';
import { AngleTool } from './angle.js';
import { ParallelTool } from './parallel.js';
import { PerpendicularTool } from './perpendicular.js';

/**
 * Manages tool lifecycle, switching, and event dispatch.
 */
export class ToolManager extends EventEmitter {
  constructor(ctx) {
    super();
    /** @type {{ store, canvas, history, measurement, onCalibrated }} */
    this._ctx = ctx;

    this.tools = [
      new SelectTool(),
      new PointTool(),
      new SegmentTool(),
      new LineTool(),
      new CircleTool(),
      new TriangleTool(),
      new MedianTool(),
      new BisectorTool(),
      new AngleTool(),
      new ParallelTool(),
      new PerpendicularTool(),
    ];

    // Inject context
    for (const t of this.tools) t.ctx = ctx;

    this.active = this.tools[0];
    this.active.activate();

    this._setupEvents();
    this._setupShortcuts();
  }

  select(toolOrName) {
    const tool = typeof toolOrName === 'string'
      ? this.tools.find(t => t.name === toolOrName || t.shortcut === toolOrName)
      : toolOrName;
    if (!tool || tool === this.active) return;
    this.active.deactivate();
    this.active = tool;
    this.active.activate();
    this.emit('change', tool);
    this._ctx.canvas.currentSnap = null;
    this._ctx.canvas.requestRender();
  }

  _setupEvents() {
    const c = this._ctx.canvas;
    c.on('mousedown', d => this.active.onMouseDown(d.world, d.event));
    c.on('mousemove', d => this.active.onMouseMove(d.world, d.event));
    c.on('mouseup',   d => this.active.onMouseUp(d.world, d.event, d.hasMoved));
    c.on('keydown',   e => this.active.onKeyDown(e));
    // Cancel in-progress tool action (e.g. when a 2nd touch starts a pinch gesture)
    c.on('cancel',    () => this.active.cancel());

    // Render preview callback
    c.onRenderPreview = (ctx) => {
      this.active.renderPreview(ctx, c);
    };
  }

  _setupShortcuts() {
    this._ctx.canvas.on('keydown', e => {
      // Ignore when typing in an input/textarea
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this._ctx.history.redo();
        else this._ctx.history.undo();
        this._ctx.canvas.requestRender();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        this._ctx.history.redo();
        this._ctx.canvas.requestRender();
        return;
      }
      // Escape → deselect all (works from any tool)
      if (e.key === 'Escape') {
        this._ctx.store.deselectAll();
        this._ctx.canvas.requestRender();
        return;
      }
      // Fit view
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        this._ctx.canvas.fitToView();
        return;
      }
      // Tool shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tool = this.tools.find(t => t.shortcut === e.key.toLowerCase());
      if (tool) this.select(tool);
    });
  }
}
