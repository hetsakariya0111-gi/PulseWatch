import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeUtc, formatResponseTime } from "@/lib/format";
import { checkErrorLabel } from "@/modules/checks/error-label";
import type { CheckLogItem } from "@/modules/checks/queries";

/**
 * Raw check log with keyset pagination.
 *
 * "Load older" moves a cursor forward through the `(monitorId, checkedAt desc)`
 * index instead of using OFFSET, so page 40 is as cheap as page 1.
 */
export function CheckHistoryTable({
  monitorId,
  items,
  nextCursor,
  after,
}: {
  monitorId: string;
  items: CheckLogItem[];
  nextCursor: string | null;
  /** The cursor this page started after, or null for the newest page. */
  after: string | null;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {after === null
          ? "No checks recorded yet. The scheduler will pick this monitor up on its next run."
          : "No older checks to show."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Checked at (UTC)</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Response time</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {formatDateTimeUtc(item.checkedAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={item.success ? "success" : "destructive"}>
                    {item.success ? "Up" : "Down"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{item.statusCode ?? "—"}</TableCell>
                <TableCell className="text-xs">{formatResponseTime(item.responseTimeMs)}</TableCell>
                <TableCell className="max-w-[24rem] truncate text-xs text-muted-foreground">
                  {item.success ? "OK" : `${checkErrorLabel(item.errorType)}${item.errorMessage ? ` — ${item.errorMessage}` : ""}`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        {after === null ? (
          <span />
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/monitors/${monitorId}`}>Back to latest</Link>
          </Button>
        )}

        {nextCursor === null ? (
          <span className="text-xs text-muted-foreground">End of history</span>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={`/monitors/${monitorId}?after=${nextCursor}`}>Load older</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
