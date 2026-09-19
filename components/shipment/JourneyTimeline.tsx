import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { formatHours, phaseRows, liveState } from '../../utils/shipmentTimeline';

type Live = NonNullable<ReturnType<typeof liveState>>;

interface Props {
  live: Live;
  paused: boolean;
  started: boolean;
  nowMs: number;
}

const fmt = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Step-by-step journey: every leg and hub stop with its status and time. */
const JourneyTimeline: React.FC<Props> = ({ live, paused, started, nowMs }) => {
  const rows = phaseRows(live.plan, live.tl);
  const at = (h: number) => nowMs + (h - live.elapsed) * 3.6e6;

  return (
    <ol className="relative space-y-0">
      {rows.map((row, i) => {
        const done = started && live.elapsed >= row.endHours - 1e-9 && live.elapsed > 0;
        const current = started && !done && live.elapsed >= row.startHours;
        const duration = row.endHours - row.startHours;
        let when: string;
        if (!started) when = `+${formatHours(row.startHours)} after pickup`;
        else if (done) when = `Done · ${fmt(at(row.endHours))}`;
        else if (current) when = paused ? 'On hold here' : `Now · ${formatHours(row.endHours - live.elapsed)} left`;
        else when = paused ? `${formatHours(row.startHours - live.elapsed)} after resume` : `From ${fmt(at(row.startHours))}`;

        return (
          <li key={row.key} className="flex gap-3 pb-3 last:pb-0">
            <div className="flex flex-col items-center">
              {done
                ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                : current
                  ? <span className={`w-4 h-4 rounded-full border-4 flex-shrink-0 ${paused ? 'border-amber-400' : 'border-blue-500 animate-pulse'}`} />
                  : <Circle size={16} className="text-gray-300 flex-shrink-0" />}
              {i < rows.length - 1 && <span className={`w-px flex-1 mt-1 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />}
            </div>
            <div className={`min-w-0 flex-1 -mt-0.5 ${current ? '' : done ? 'opacity-70' : 'opacity-90'}`}>
              <p className={`text-xs font-semibold truncate ${current ? 'text-[#0a192f]' : 'text-gray-700'}`}>
                <span className="mr-1">{row.icon}</span>{row.title}
                <span className="font-normal text-gray-400"> · {formatHours(duration)}</span>
              </p>
              <p className="text-[11px] text-gray-500 truncate">{row.subtitle}</p>
              <p className={`text-[10px] ${current ? (paused ? 'text-amber-600 font-semibold' : 'text-blue-600 font-semibold') : 'text-gray-400'}`}>{when}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default JourneyTimeline;
