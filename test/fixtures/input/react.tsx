"use client";
import { Content } from "@/types";
import LongCard from "@/components/InlineCard";

export default function ContentList({
  data,
  search,
  status
}: {
  data: Content[];
  search: string | undefined;
  status: string | undefined;
}) {
  if (data.length === 0) {
    let message = "No content available at the moment.";
    if (search && status) {
      message = `No content found for "${search}" with status "${status}"`;
    } else if (search) {
      message = `No content found for "${search}"`;
    } else if (status) {
      message = `No content found with status "${status}"`;
    }
    return (
      <div className="text-center py-10 mx-auto">
        <p className="text-black/50">
          {message}
        </p>
      </div>
    );
  }

  return (
    <div>
      {data.map((data) => (
        <LongCard key={data.id} content={data} />
      ))}
    </div>
  );
}