const LAYERS = [
  { label: '应用层', y: 28 },
  { label: '传输层', y: 66 },
  { label: '网络层', y: 104 },
  { label: '数据链路层', y: 142 },
  { label: '物理层', y: 180 },
];

export function HandshakeDiagram({
  className = '',
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  const line = dark ? 'rgba(255,255,255,0.16)' : 'var(--line-strong)';
  const strong = dark ? 'rgba(255,255,255,0.34)' : 'var(--line-strong)';
  const label = dark ? 'rgba(255,255,255,0.55)' : 'var(--ink-600)';
  const link = dark ? '#7fd8cb' : 'var(--brand-600)';
  const signal = dark ? '#e7b36a' : 'var(--warning)';
  const surface = dark ? 'var(--ink-900)' : 'var(--surface)';

  return (
    <div className={className}>
      <svg
        viewBox="0 0 400 160"
        role="img"
        aria-label="TCP 三次握手：客户端发送 SYN，服务器回复 SYN 和 ACK，客户端再发送 ACK"
        className="h-auto w-full"
      >
        <defs>
          <marker
            id="handshake-arrow-link"
            viewBox="0 0 6 6"
            refX="5.5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0 0 L6 3 L0 6 Z" fill={link} />
          </marker>
          <marker
            id="handshake-arrow-signal"
            viewBox="0 0 6 6"
            refX="5.5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0 0 L6 3 L0 6 Z" fill={signal} />
          </marker>
        </defs>

        <g fontFamily="'IBM Plex Mono', monospace">
          <text x="84" y="12" textAnchor="middle" fontSize="9.5" fill={label}>
            客户端
          </text>
          <text x="316" y="12" textAnchor="middle" fontSize="9.5" fill={label}>
            服务器
          </text>
        </g>

        <g stroke={line} strokeWidth="1" strokeDasharray="3 4">
          <line x1="84" y1="26" x2="84" y2="146" />
          <line x1="316" y1="26" x2="316" y2="146" />
        </g>

        <g fill={surface} stroke={strong} strokeWidth="1">
          <circle cx="84" cy="26" r="2.4" />
          <circle cx="316" cy="26" r="2.4" />
        </g>

        <line
          x1="84"
          y1="52"
          x2="316"
          y2="52"
          stroke={signal}
          strokeWidth="1.2"
          markerEnd="url(#handshake-arrow-signal)"
        />
        <circle cx="84" cy="52" r="3" fill={signal} />
        <text
          x="200"
          y="43"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="10"
          fill={signal}
        >
          SYN
        </text>
        <text
          x="200"
          y="65"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="8.5"
          fill={label}
        >
          seq = x
        </text>

        <line
          x1="316"
          y1="88"
          x2="84"
          y2="88"
          stroke={link}
          strokeWidth="1.2"
          markerEnd="url(#handshake-arrow-link)"
        />
        <text
          x="200"
          y="79"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="10"
          fill={link}
        >
          SYN + ACK
        </text>
        <text
          x="200"
          y="101"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="8.5"
          fill={label}
        >
          seq = y · ack = x + 1
        </text>

        <line
          x1="84"
          y1="124"
          x2="316"
          y2="124"
          stroke={link}
          strokeWidth="1.2"
          markerEnd="url(#handshake-arrow-link)"
        />
        <text
          x="200"
          y="115"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="10"
          fill={link}
        >
          ACK
        </text>
        <text
          x="200"
          y="137"
          textAnchor="middle"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="8.5"
          fill={label}
        >
          ack = y + 1
        </text>
      </svg>
    </div>
  );
}

export function LayerDiagram({
  className = '',
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  const line = dark ? 'rgba(255,255,255,0.16)' : 'var(--line-strong)';
  const strong = dark ? 'rgba(255,255,255,0.34)' : 'var(--line-strong)';
  const label = dark ? 'rgba(255,255,255,0.56)' : 'var(--ink-600)';
  const signal = dark ? '#e7b36a' : 'var(--warning)';
  const signalSoft = dark ? 'rgba(231,179,106,0.16)' : 'var(--warning-50)';
  const surface = dark ? 'var(--ink-900)' : 'var(--surface)';

  return (
    <div className={className}>
      <svg
        viewBox="0 0 400 208"
        role="img"
        aria-label="一次请求依次穿过应用层、传输层、网络层、数据链路层和物理层"
        className="h-auto w-full"
      >
        <g fontFamily="'IBM Plex Mono', monospace" fontSize="10" fill={label}>
          {LAYERS.map((layer) => (
            <text key={layer.label} x="0" y={layer.y + 3.5}>
              {layer.label}
            </text>
          ))}
        </g>

        <g stroke={line} strokeWidth="1">
          {LAYERS.map((layer) => (
            <line key={layer.label} x1="72" y1={layer.y} x2="400" y2={layer.y} />
          ))}
        </g>

        <line
          x1="296"
          y1="14"
          x2="296"
          y2="194"
          stroke={dark ? 'rgba(127,216,203,0.4)' : 'var(--brand-line)'}
          strokeWidth="1"
          strokeDasharray="3 4"
        />

        {LAYERS.map((layer) => (
          <circle
            key={layer.label}
            cx="296"
            cy={layer.y}
            r="2.6"
            fill={surface}
            stroke={strong}
            strokeWidth="1.2"
          />
        ))}

        <circle cx="296" cy="66" r="6.5" fill={signalSoft} />
        <circle cx="296" cy="66" r="3.2" fill={signal} />

        <g fontFamily="'IBM Plex Mono', monospace" fontSize="9" fill={signal}>
          <text x="308" y="59">
            SYN · seq=x
          </text>
        </g>

        <g stroke={line} strokeWidth="1" strokeDasharray="2 4">
          <line x1="72" y1="194" x2="400" y2="194" />
        </g>
        <text
          x="72"
          y="206"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="9"
          fill={label}
        >
          一次请求的路径
        </text>
      </svg>
    </div>
  );
}
