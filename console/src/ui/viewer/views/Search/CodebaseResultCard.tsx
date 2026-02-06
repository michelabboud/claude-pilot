import { Card, CardBody, Badge, Icon } from '../../components/ui';

interface VexorSearchResult {
  rank: number;
  score: number;
  filePath: string;
  chunkIndex: number;
  startLine: number | null;
  endLine: number | null;
  snippet: string;
}

interface CodebaseResultCardProps {
  result: VexorSearchResult;
}

function getScoreColor(score: number): string {
  if (score >= 0.7) return 'text-success';
  if (score >= 0.4) return 'text-warning';
  return 'text-base-content/50';
}

function getScoreBarColor(score: number): string {
  if (score >= 0.7) return 'bg-success';
  if (score >= 0.4) return 'bg-warning';
  return 'bg-base-content/30';
}

function shortenPath(filePath: string): string {
  if (filePath.startsWith('./')) return filePath.slice(2);
  return filePath;
}

export function CodebaseResultCard({ result }: CodebaseResultCardProps) {
  const scorePercent = Math.round(result.score * 100);
  const displayPath = shortenPath(result.filePath);
  const hasLines = result.startLine !== null && result.endLine !== null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardBody>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-base-200 shrink-0">
            <Icon icon="lucide:file-code" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="info" size="xs">File</Badge>
              {hasLines && (
                <Badge variant="ghost" size="xs">
                  L{result.startLine}–{result.endLine}
                </Badge>
              )}
              {result.score > 0 && (
                <span className={`ml-auto text-xs font-mono ${getScoreColor(result.score)}`}>
                  {scorePercent}% match
                </span>
              )}
            </div>
            <h3 className="font-medium font-mono text-sm truncate">{displayPath}</h3>
            {result.snippet && (
              <pre className="text-xs text-base-content/60 mt-2 p-2 bg-base-200 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-24 leading-relaxed">
                {result.snippet}
              </pre>
            )}
          </div>
          {result.score > 0 && (
            <div className="w-16 shrink-0 hidden sm:block">
              <div className="h-2 bg-base-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getScoreBarColor(result.score)}`}
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
              <div className="text-[10px] text-center mt-1 text-base-content/50">similarity</div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
