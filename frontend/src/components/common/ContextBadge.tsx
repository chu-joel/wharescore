'use client';

type Sentiment = 'positive' | 'neutral' | 'negative';

interface ContextBadgeProps {
  text: string;
  sentiment?: Sentiment;
}

const STYLES: Record<Sentiment, string> = {
  positive: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300',
  negative: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export function ContextBadge({ text, sentiment = 'neutral' }: ContextBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[sentiment]}`}>
      {text}
    </span>
  );
}
