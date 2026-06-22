import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  if (totalPages <= 1) return null;
  const Prev = isAr ? ChevronRight : ChevronLeft;
  const Next = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="flex items-center justify-center gap-2 pt-4 pb-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <Prev className="h-4 w-4" />
        {t("common.previous")}
      </Button>
      <span className="text-sm text-muted-foreground px-2">
        {isAr ? `${page} / ${totalPages}` : `${t("common.page")} ${page} / ${totalPages}`}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {t("common.next")}
        <Next className="h-4 w-4" />
      </Button>
    </div>
  );
}
