import type { APIRoute } from 'astro';
import { FEES_REPORT_CSV_FILENAME, buildFeesReportCsv } from '@/lib/seo/feesReport';

export const prerender = true;

/** /barber-booking-fees-uk/fees.csv: the fees report tables as data for writers and other tools. */
export const GET: APIRoute = () => {
  return new Response(buildFeesReportCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${FEES_REPORT_CSV_FILENAME}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
