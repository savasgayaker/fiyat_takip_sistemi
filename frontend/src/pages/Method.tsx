import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import katex from "katex";
import { marked } from "marked";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState, ErrorState } from "@/components/common/States";
import { getMethod } from "@/lib/api";
import { tr } from "@/i18n/tr";

function renderMarkdown(md: string): string {
  let s = md.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex) =>
    katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }),
  );
  s = s.replace(/\$([^$\n]+?)\$/g, (_m, tex) =>
    katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }),
  );
  return marked.parse(s) as string;
}

export default function Method() {
  const q = useQuery({ queryKey: ["method"], queryFn: getMethod });
  const html = useMemo(
    () => (q.data ? renderMarkdown(q.data.markdown) : ""),
    [q.data],
  );

  return (
    <div data-testid="page-method">
      <PageHeader title={tr.method.title} />
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <Card>
          <CardContent className="p-8">
            <article
              className="prose-method max-w-none"
              data-testid="method-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
