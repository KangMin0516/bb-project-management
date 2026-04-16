interface Answer {
  question: { text: string; ignoreText: string };
  answer: string | null;
  order: number;
}

interface ReportData {
  username: string;
  configName: string;
  answers: Answer[];
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  ANSWERED: '#36a64f',
  AWAY: '#daa038',
  CANCELED: '#999999',
  UNANSWERED: '#cc0000',
};

function isIgnored(answer: string | null, ignoreText: string): boolean {
  if (!answer) return true;
  const ignoreWords = ignoreText
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  return ignoreWords.includes(answer.trim().toLowerCase());
}

export function formatStandupReport(report: ReportData): {
  attachments: unknown[];
  text: string;
} {
  const color = STATUS_COLORS[report.status] ?? '#999999';

  if (report.status === 'AWAY') {
    return {
      attachments: [
        {
          color,
          author_name: report.username ?? 'Unknown',
          text: '_Away today_',
          mrkdwn_in: ['text'],
        },
      ],
      text: `${report.username} - Away`,
    };
  }

  if (report.status === 'CANCELED') {
    return {
      attachments: [
        {
          color,
          author_name: report.username ?? 'Unknown',
          text: '_Report canceled_',
          mrkdwn_in: ['text'],
        },
      ],
      text: `${report.username} - Canceled`,
    };
  }

  if (report.status === 'UNANSWERED') {
    return {
      attachments: [
        {
          color,
          author_name: report.username ?? 'Unknown',
          text: '_Did not respond_',
          mrkdwn_in: ['text'],
        },
      ],
      text: `${report.username} - Unanswered`,
    };
  }

  // ANSWERED
  const sortedAnswers = [...report.answers].sort((a, b) => a.order - b.order);
  const fields = sortedAnswers.map((a) => ({
    title: a.question.text,
    value: isIgnored(a.answer, a.question.ignoreText)
      ? '_Nothing to report_'
      : a.answer,
    short: false,
  }));

  return {
    attachments: [
      {
        color,
        author_name: report.username ?? 'Unknown',
        fields,
        mrkdwn_in: ['text', 'fields'],
      },
    ],
    text: `${report.username} - Standup Report`,
  };
}
