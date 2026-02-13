import { useState, useEffect, useCallback } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SCROLL_END_THRESHOLD = 120;

export interface ScrollToEndsProps {
  /** When provided (e.g. admin main), use this element's scroll. Otherwise use window. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export function ScrollToEnds({ scrollContainerRef }: ScrollToEndsProps) {
  const [atBottom, setAtBottom] = useState(false);
  const [isScrollable, setIsScrollable] = useState(true);

  const updateState = useCallback(() => {
    const el = scrollContainerRef?.current;

    if (el) {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const scrollable = scrollHeight > clientHeight;
      setIsScrollable(scrollable);
      if (!scrollable) return;
      setAtBottom(
        scrollTop + clientHeight >= scrollHeight - SCROLL_END_THRESHOLD
      );
    } else {
      if (typeof window === "undefined") return;
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const scrollable = scrollHeight > clientHeight;
      setIsScrollable(scrollable);
      if (!scrollable) return;
      setAtBottom(
        scrollTop + clientHeight >= scrollHeight - SCROLL_END_THRESHOLD
      );
    }
  }, [scrollContainerRef]);

  useEffect(() => {
    updateState();

    const el = scrollContainerRef?.current ?? null;
    const scrollTarget = el ?? window;
    scrollTarget.addEventListener("scroll", updateState, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && el) {
      resizeObserver = new ResizeObserver(updateState);
      resizeObserver.observe(el);
    }

    return () => {
      scrollTarget.removeEventListener("scroll", updateState);
      if (resizeObserver && el) {
        resizeObserver.unobserve(el);
      }
    };
  }, [updateState, scrollContainerRef]);

  const scrollToTop = () => {
    const el = scrollContainerRef?.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToBottom = () => {
    const el = scrollContainerRef?.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleClick = () => {
    if (atBottom) scrollToTop();
    else scrollToBottom();
  };

  const label = atBottom ? "Scroll to top" : "Scroll to bottom";

  if (!isScrollable) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleClick}
          size="icon"
          aria-label={label}
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg transition-all duration-300 bg-gradient-primary hover:opacity-90"
        >
          {atBottom ? (
            <ArrowUp className="h-5 w-5" />
          ) : (
            <ArrowDown className="h-5 w-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
