import { ChevronRight, Terminal, Zap } from 'lucide-react'

// Passe bgImage="/sua-imagem.png" quando tiver o PNG pronto.
// Sem bgImage, cai no fundo fragmentado em CSS que já existia.
export default function Gate({ onContinue, bgImage }) {
    return (
        <div className="gate">
            <style>{`
        .gate {
          min-height: 100dvh;
          background: radial-gradient(ellipse at 50% 20%, #2a0606 0%, #0a0304 55%, #050203 100%);
          color: #f5e4e4;
          padding: 18px 16px 28px;
          display: flex;
          flex-direction: column;
          font-family: inherit;
          position: relative;
          overflow: hidden;
        }

        /* animação de glitch única, reaproveitada em cada elemento com delay diferente */
        @keyframes gateGlitch {
          0%, 95.5%, 100% { transform: translate(0,0) skewX(0deg); filter: none; }
          96%   { transform: translate(-6px, 2px) skewX(1.4deg); filter: hue-rotate(25deg) saturate(2.2) brightness(1.25); }
          96.4% { transform: translate(5px, -2px) skewX(-1.6deg); filter: saturate(2) contrast(1.5); }
          96.8% { transform: translate(-4px, 1px) skewX(1deg); filter: hue-rotate(-18deg) brightness(1.2); }
          97.2% { transform: translate(3px, -1px) skewX(-0.6deg); filter: contrast(1.6); }
          97.6% { transform: translate(-2px, 0) skewX(0deg); filter: saturate(1.6); }
          98%   { transform: translate(0,0) skewX(0deg); filter: none; }
        }
        .glitch-a { animation: gateGlitch 5s steps(1) infinite; animation-delay: 0s; }
        .glitch-b { animation: gateGlitch 5.6s steps(1) infinite; animation-delay: 0.9s; }
        .glitch-c { animation: gateGlitch 4.4s steps(1) infinite; animation-delay: 1.8s; }
        .glitch-d { animation: gateGlitch 6.2s steps(1) infinite; animation-delay: 2.6s; }
        .glitch-e { animation: gateGlitch 5.1s steps(1) infinite; animation-delay: 3.4s; }
        .glitch-f { animation: gateGlitch 4.8s steps(1) infinite; animation-delay: 4.2s; }

        .gate-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          position: relative;
          z-index: 2;
        }
        .gate-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255, 90, 90, 0.35);
          background: rgba(120, 20, 20, 0.18);
          border-radius: 10px;
          padding: 8px 12px;
          font-family: monospace;
          font-size: 11px;
          letter-spacing: 0.04em;
          color: #ffb3b3;
        }
        .gate-chip .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ff3b3b;
          box-shadow: 0 0 8px 2px rgba(255, 59, 59, 0.8);
          animation: gatePulse 1.6s ease-in-out infinite;
          flex-shrink: 0;
        }
        .gate-chip .accent { color: #ff8080; }
        .gate-chip .dim { color: #b98a8a; }
        @keyframes gatePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        /* ==== FUNDO: imagem PNG (quando informada) ou fragmentado em CSS ==== */
        .gate-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .gate-bg.has-image {
          background-image: url(${bgImage});
          background-size: cover;
          background-position: center;
        }
        .gate-bg.has-image::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(8,3,4,0.55) 0%, rgba(8,3,4,0.25) 45%, rgba(8,3,4,0.75) 100%);
        }

        /* fundo quadriculado / fragmentado (fallback sem imagem) */
        .gate-frag {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image:
            repeating-linear-gradient(0deg, rgba(255,70,70,0.07) 0px, rgba(255,70,70,0.07) 1px, transparent 1px, transparent 28px),
            repeating-linear-gradient(90deg, rgba(255,70,70,0.07) 0px, rgba(255,70,70,0.07) 1px, transparent 1px, transparent 28px);
          mask-image: radial-gradient(ellipse at 50% 42%, black 0%, black 35%, transparent 78%);
          -webkit-mask-image: radial-gradient(ellipse at 50% 42%, black 0%, black 35%, transparent 78%);
        }
        .gate-shard {
          position: absolute;
          z-index: 0;
          background: linear-gradient(135deg, rgba(255,60,60,0.16), rgba(255,60,60,0.02));
          border: 1px solid rgba(255,110,110,0.18);
          pointer-events: none;
        }
        .gate-shard.s1 { top: 14%; left: 8%;  width: 70px;  height: 70px; clip-path: polygon(0 0, 100% 15%, 70% 100%, 0 65%); transform: rotate(-8deg); }
        .gate-shard.s2 { top: 60%; left: 4%;  width: 55px;  height: 90px; clip-path: polygon(20% 0, 100% 10%, 80% 100%, 0 80%); transform: rotate(12deg); }
        .gate-shard.s3 { top: 10%; right: 6%; width: 80px;  height: 60px; clip-path: polygon(10% 0, 100% 20%, 85% 100%, 0 70%); transform: rotate(20deg); }
        .gate-shard.s4 { top: 66%; right: 5%; width: 60px;  height: 80px; clip-path: polygon(0 10%, 90% 0, 100% 90%, 15% 100%); transform: rotate(-15deg); }
        .gate-shard.s5 { top: 40%; left: 50%; width: 100px; height: 50px; clip-path: polygon(5% 0, 100% 25%, 95% 100%, 0 75%); transform: translateX(-50%) rotate(4deg); opacity: 0.5; }

        .gate-portal-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 0 16px;
          position: relative;
          z-index: 1;
        }

        /* fenda oval — sem círculo central preenchido, só os dois anéis */
        .gate-portal {
          position: relative;
          width: 260px;
          height: 180px;
        }
        .gate-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid rgba(255, 80, 80, 0.35);
        }
        .gate-ring.r2 {
          inset: 22px 30px;
          border: 1px solid rgba(255, 130, 130, 0.6);
          box-shadow: 0 0 30px 6px rgba(255, 40, 40, 0.18), inset 0 0 24px rgba(255, 40, 40, 0.15);
        }

        /* bolinhas orbitando em trajetória oval (squish + contra-squish) */
        .gate-orbit-wrap {
          position: absolute;
          top: 50%; left: 50%;
          width: 260px; height: 260px;
          margin: -130px 0 0 -130px;
          transform: scaleY(0.72);
        }
        .gate-orbit-wrap.slow { animation: gateSpin 9s linear infinite; }
        .gate-orbit-wrap.fast { width: 190px; height: 190px; margin: -95px 0 0 -95px; animation: gateSpinRev 5.5s linear infinite; }
        .gate-orbit-wrap.mid  { width: 225px; height: 225px; margin: -112px 0 0 -112px; animation: gateSpin 7s linear infinite; }
        .gate-orbit-wrap .pt {
          position: absolute;
          top: -3px; left: 50%;
          width: 6px; height: 6px;
          margin-left: -3px;
          border-radius: 50%;
          background: #ff5c5c;
          box-shadow: 0 0 10px 3px rgba(255, 60, 60, 0.9);
          transform: scaleY(1.38); /* contra-squish pra bolinha ficar redonda */
        }
        .gate-orbit-wrap.fast .pt { width: 4px; height: 4px; margin-left: -2px; background: #ff9090; box-shadow: 0 0 8px 2px rgba(255,120,120,0.85); }
        .gate-orbit-wrap.mid .pt { opacity: 0.8; }
        @keyframes gateSpin { from { transform: scaleY(0.72) rotate(0deg); } to { transform: scaleY(0.72) rotate(360deg); } }
        @keyframes gateSpinRev { from { transform: scaleY(0.72) rotate(360deg); } to { transform: scaleY(0.72) rotate(0deg); } }

        .gate-tick {
          position: absolute;
          font-family: monospace;
          font-size: 10px;
          color: rgba(255, 150, 150, 0.55);
        }
        .gate-tick.top { top: 2px; left: 50%; transform: translateX(-50%); }
        .gate-tick.left { left: 10px; top: 50%; transform: translateY(-50%); }
        .gate-tick.right { right: 10px; top: 50%; transform: translateY(-50%); }
        .gate-tick.bottom { bottom: 2px; left: 50%; transform: translateX(-50%); }
        .gate-arrow {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          color: #ff4d4d;
          filter: drop-shadow(0 0 6px rgba(255, 60, 60, 0.8));
          z-index: 2;
        }
        .gate-center {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: monospace;
          font-size: 12px;
          letter-spacing: 0.18em;
          color: rgba(255, 190, 190, 0.55);
        }

        .gate-tag {
          align-self: center;
          font-family: monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          color: #ff8f8f;
          border: 1px solid rgba(255, 90, 90, 0.4);
          border-radius: 8px;
          padding: 5px 12px;
          margin: 14px 0 14px;
          position: relative;
          z-index: 1;
        }

        .gate-quest {
          display: flex;
          justify-content: space-between;
          border: 1px solid rgba(255, 90, 90, 0.3);
          background: rgba(90, 15, 15, 0.2);
          border-radius: 12px;
          padding: 12px 14px;
          margin: 0 0 14px;
          font-family: monospace;
          font-size: 11px;
          position: relative;
          z-index: 1;
        }
        .gate-quest > div { display: flex; flex-direction: column; gap: 3px; }
        .gate-quest .k { color: #c98a8a; letter-spacing: 0.04em; }
        .gate-quest .v { color: #ffdede; font-weight: 700; }
        .gate-quest .v.accent { color: #ff5c5c; }

        /* botão logo abaixo da fenda: vermelho escuro chapado e semi-transparente,
           próximo do tom do fundo mas com borda/glow pra manter contraste */
        .gate-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          border: 1px solid rgba(255, 90, 90, 0.45);
          border-radius: 0;
          clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
          padding: 18px 20px;
          background: rgba(120, 18, 22, 0.55);
          box-shadow: 0 0 18px rgba(255, 40, 40, 0.2), inset 0 0 22px rgba(0, 0, 0, 0.35);
          color: #ffe2e2;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.02em;
          cursor: pointer;
          position: relative;
          z-index: 1;
          margin-bottom: 16px;
        }
        .gate-spacer {
        flex: 1;
        }
        .gate-cta:active { transform: translateY(1px); }
      `}</style>

            {bgImage ? <div className="gate-bg has-image glitch-b" /> : (
                <>
                    <div className="gate-frag glitch-b" />
                    <div className="gate-shard s1 glitch-b" />
                    <div className="gate-shard s2 glitch-c" />
                    <div className="gate-shard s3 glitch-d" />
                    <div className="gate-shard s4 glitch-e" />
                    <div className="gate-shard s5 glitch-f" />
                </>
            )}

            <div className="gate-topbar glitch-a">
                <div className="gate-chip">
                    <span className="dot" />
                    [SISTEMA: <span className="accent">ONLINE</span> // <span className="dim">FENDA ATIVA</span>]
                </div>
                <div className="gate-chip">
                    <Terminal size={13} />
                    TERMINAL V.4.8
                </div>
            </div>

            <div className="gate-spacer" />

            <button className="gate-cta glitch-d" onClick={onContinue}>
                <Zap size={18} />
                <span>ENTRAR NA FENDA</span>
                <ChevronRight size={18} />
            </button>

            <p className="gate-tag glitch-e">[FENDA DETECTADA]</p>

            <div className="gate-quest glitch-f">
                <div>
                    <span className="k">QUEST:</span>
                    <span className="v">ATRAVESSAR</span>
                </div>
                <div>
                    <span className="k">RECOMPENSA:</span>
                    <span className="v accent">DESPERTAR</span>
                </div>
                <div>
                    <span className="k">PENALIDADE:</span>
                    <span className="v">NENHUMA</span>
                </div>
            </div>
        </div>
    )
}