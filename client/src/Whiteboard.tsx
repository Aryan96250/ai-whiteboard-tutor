import { useEffect, useRef } from 'react';
import type { BoardElement } from './types';

interface Props { elements: BoardElement[]; activeTitle: string; }

const PALE_FILLS = new Set(['#efeeff', '#e8f7f3', '#fff1e6', '#f1f4f8']);

export default function Whiteboard({ elements, activeTitle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    ctx.strokeStyle = '#edf0f4'; ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    const sx = width / 1000; const sy = height / 620;
    const scale = Math.min(sx, sy);
    const px = (x: number) => x * sx; const py = (y: number) => y * sy;
    elements.forEach((item) => {
      const color = item.color || '#5256d8';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.min(4, Math.max(1, ('width' in item && item.width) || 2.5)) * scale;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (item.type === 'text') {
        const fontSize = Math.min(38, Math.max(12, item.size || 24));
        ctx.font = `600 ${fontSize * scale}px "DM Sans", sans-serif`;
        ctx.textAlign = item.align || 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(item.text, px(item.x), py(item.y), px(430));
      } else if (item.type === 'formula') {
        const fontSize = Math.min(38, Math.max(12, item.size || 30));
        ctx.font = `700 ${fontSize * scale}px "Space Grotesk", sans-serif`;
        ctx.textBaseline = 'middle'; ctx.fillText(item.text, px(item.x), py(item.y), px(430));
      } else if (item.type === 'circle') {
        const radius = Math.min(55, Math.max(18, item.radius));
        ctx.beginPath(); ctx.arc(px(item.x), py(item.y), px(radius), 0, Math.PI * 2);
        if (item.fill && PALE_FILLS.has(item.fill.toLowerCase())) {
          ctx.fillStyle = item.fill; ctx.fill(); ctx.fillStyle = color;
        }
        ctx.stroke();
        if (item.label) {
          ctx.font = `600 ${16 * scale}px "DM Sans"`; ctx.textAlign = 'center';
          ctx.textBaseline = 'middle'; ctx.fillText(item.label, px(item.x), py(item.y), px(radius * 1.7));
        }
      } else if (item.type === 'rect') {
        const rectWidth = Math.min(220, Math.max(70, item.width));
        const rectHeight = Math.min(130, Math.max(45, item.height));
        const rectX = Math.min(1000 - rectWidth - 12, Math.max(12, item.x));
        const rectY = Math.min(620 - rectHeight - 12, Math.max(12, item.y));
        if (item.fill && PALE_FILLS.has(item.fill.toLowerCase())) {
          ctx.fillStyle = item.fill;
          ctx.fillRect(px(rectX), py(rectY), px(rectWidth), py(rectHeight));
          ctx.fillStyle = color;
        }
        ctx.strokeRect(px(rectX), py(rectY), px(rectWidth), py(rectHeight));
        if (item.label) {
          ctx.font = `600 ${16 * scale}px "DM Sans"`; ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.label, px(rectX + rectWidth / 2), py(rectY + rectHeight / 2), px(rectWidth - 12));
        }
      } else {
        ctx.beginPath(); ctx.moveTo(px(item.x1), py(item.y1)); ctx.lineTo(px(item.x2), py(item.y2)); ctx.stroke();
        if (item.type === 'arrow') {
          const angle = Math.atan2(py(item.y2 - item.y1), px(item.x2 - item.x1));
          const head = 11 * scale;
          ctx.beginPath(); ctx.moveTo(px(item.x2), py(item.y2));
          ctx.lineTo(px(item.x2) - head * Math.cos(angle - Math.PI / 6), py(item.y2) - head * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(px(item.x2) - head * Math.cos(angle + Math.PI / 6), py(item.y2) - head * Math.sin(angle + Math.PI / 6));
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    });
    ctx.restore();
    ctx.fillStyle = '#8b92a4'; ctx.font = '600 11px "DM Sans"'; ctx.textAlign = 'right';
    ctx.fillText('LEARNBOARD  /  LIVE CANVAS', width - 22, height - 18);
  }, [elements, activeTitle]);

  return <div className="board-wrap"><div className="board-topline"><span className="live-dot" /> Interactive whiteboard <span className="board-step">{activeTitle || 'Ready to teach'}</span></div><canvas ref={canvasRef} className="whiteboard" aria-label="Animated lesson whiteboard" /></div>;
}
