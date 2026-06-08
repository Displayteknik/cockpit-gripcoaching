"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renderar specialist-output som snygg, läsbar HTML istället för rå markdown med synliga #.
export default function MarkdownView({ children }: { children: string }) {
  return (
    <div className="text-sm text-gray-800 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="text-xl font-bold text-gray-900 mt-5 mb-2 first:mt-0" {...p} />,
          h2: (p) => <h2 className="text-lg font-semibold text-gray-900 mt-5 mb-2 pb-1 border-b border-gray-100 first:mt-0" {...p} />,
          h3: (p) => <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1.5" {...p} />,
          p: (p) => <p className="text-gray-700 mb-3" {...p} />,
          ul: (p) => <ul className="list-disc pl-5 space-y-1 mb-3 text-gray-700" {...p} />,
          ol: (p) => <ol className="list-decimal pl-5 space-y-1.5 mb-3 text-gray-700" {...p} />,
          li: (p) => <li className="text-gray-700" {...p} />,
          strong: (p) => <strong className="font-semibold text-gray-900" {...p} />,
          a: (p) => <a className="text-blue-600 hover:underline" {...p} />,
          blockquote: (p) => <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-600 mb-3" {...p} />,
          hr: () => <hr className="my-4 border-gray-100" />,
          table: (p) => <div className="overflow-x-auto mb-3"><table className="w-full text-sm border-collapse" {...p} /></div>,
          th: (p) => <th className="border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left font-medium text-gray-700" {...p} />,
          td: (p) => <td className="border border-gray-200 px-2.5 py-1.5 align-top text-gray-700" {...p} />,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || "");
            return isBlock ? (
              <code className="block bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs font-mono my-2 whitespace-pre" {...props}>{children}</code>
            ) : (
              <code className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono text-gray-800" {...props}>{children}</code>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
