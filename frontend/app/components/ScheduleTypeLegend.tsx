import { BookOpen, FlaskConical, PenTool } from 'lucide-react';

interface ScheduleTypeLegendProps {
    lectureLabel: string;
    labLabel: string;
    problemSessionLabel: string;
    className?: string;
}

interface ScheduleTypeIconProps {
    type?: string;
    className?: string;
}

const items = [
    {
        type: 'lecture',
        icon: BookOpen,
        color: 'bg-lecture/15 text-blue-300 border-lecture/30',
    },
    {
        type: 'lab',
        icon: FlaskConical,
        color: 'bg-lab/15 text-purple-300 border-lab/30',
    },
    {
        type: 'ps',
        icon: PenTool,
        color: 'bg-ps/15 text-emerald-300 border-ps/30',
    },
] as const;

export function ScheduleTypeIcon({ type = 'lecture', className = 'h-3 w-3' }: ScheduleTypeIconProps) {
    const item = items.find((candidate) => candidate.type === type.toLowerCase()) || items[0];
    const Icon = item.icon;
    return <Icon className={className} aria-hidden="true" />;
}

export function ScheduleTypeLegend({
    lectureLabel,
    labLabel,
    problemSessionLabel,
    className = '',
}: ScheduleTypeLegendProps) {
    const labels = {
        lecture: lectureLabel,
        lab: labLabel,
        ps: problemSessionLabel,
    };

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <span
                        key={item.type}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${item.color}`}
                    >
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {labels[item.type]}
                    </span>
                );
            })}
        </div>
    );
}
