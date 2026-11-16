import { useEffect, useRef } from 'react';
import type { BoardElement } from './types';

interface Props { elements: BoardElement[]; activeTitle: string; }

export default function Whiteboard({ elements, activeTitle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#edf0f4'; ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    const sx = width / 1000; const sy = height / 620;
    const px = (x: number) => x * sx; const py = (y: number) => y * sy;
    elements.forEach((item) => {
      const color = item.color || '#5256d8';
      ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = (('width' in item && item.width) || 2.5) * Math.min(sx, sy);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (item.type === 'text') {
        ctx.font = `600 ${(item.size || 24) * Math.min(sx, sy)}px "DM Sans", sans-serif`;
        ctx.textAlign = item.align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(item.text, px(item.x), py(item.y), px(430));
      } else if (item.type === 'formula') {
        ctx.font = `700 ${(item.size || 30) * Math.min(sx, sy)}px "Space Grotesk", sans-serif`;
        ctx.textBaseline = 'middle'; ctx.fillText(item.text, px(item.x), py(item.y));
      } else if (item.type === 'circle') {
        ctx.beginPath(); ctx.arc(px(item.x), py(item.y), px(item.radius), 0, Math.PI * 2);
        if (item.fill) { ctx.fillStyle = item.fill; ctx.fill(); ctx.fillStyle = color; }
        ctx.stroke();
        if (item.label) { ctx.font = `600 ${16 * Math.min(sx, sy)}px "DM Sans"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.label, px(item.x), py(item.y)); }
      } else if (item.type === 'rect') {
        if (item.fill) { ctx.fillStyle = item.fill; ctx.fillRect(px(item.x), py(item.y), px(item.width), py(item.height)); ctx.fillStyle = color; }
        ctx.strokeRect(px(item.x), py(item.y), px(item.width), py(item.height));
        if (item.label) { ctx.font = `600 ${16 * Math.min(sx, sy)}px "DM Sans"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.label, px(item.x + item.width / 2), py(item.y + item.height / 2)); }
      } else {
        ctx.beginPath(); ctx.moveTo(px(item.x1), py(item.y1)); ctx.lineTo(px(item.x2), py(item.y2)); ctx.stroke();
        if (item.type === 'arrow') {
          const angle = Math.atan2(py(item.y2 - item.y1), px(item.x2 - item.x1)); const head = 11 * Math.min(sx, sy);
          ctx.beginPath(); ctx.moveTo(px(item.x2), py(item.y2));
          ctx.lineTo(px(item.x2) - head * Math.cos(angle - Math.PI / 6), py(item.y2) - head * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(px(item.x2) - head * Math.cos(angle + Math.PI / 6), py(item.y2) - head * Math.sin(angle + Math.PI / 6));
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    });
    ctx.fillStyle = '#8b92a4'; ctx.font = '600 11px "DM Sans"'; ctx.textAlign = 'right';
    ctx.fillText('LEARNBOARD  /  LIVE CANVAS', width - 22, height - 18);
  }, [elements, activeTitle]);

  return <div className="board-wrap"><div className="board-topline"><span className="live-dot" /> Interactive whiteboard <span className="board-step">{activeTitle || 'Ready to teach'}</span></div><canvas ref={canvasRef} className="whiteboard" aria-label="Animated lesson whiteboard" /></div>;
}