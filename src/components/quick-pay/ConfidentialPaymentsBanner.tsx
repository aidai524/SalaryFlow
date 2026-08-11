import { AnimatePresence, motion } from "motion/react";
import { IconLock } from "@/components/icons/lock";

export function ConfidentialPaymentsBanner({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="confidential-banner"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="mb-4 flex flex-col gap-1 rounded-[12px] border border-[#d0f348] bg-[rgba(208,243,72,0.2)] px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#84a20f] text-white">
              <IconLock className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="font-montserrat text-[14px] font-semibold text-[#606060]">
                Confidential payments active
              </p>
              <p className="font-montserrat text-[12px] font-medium text-[#606060]">
                Recipient wallets are not directly linked to your treasury on-chain.
              </p>
            </div>
          </div>
          <a
            href=""
            onClick={(e) => e.preventDefault()}
            className="shrink-0 self-end font-montserrat text-[12px] font-medium text-[#606060] underline underline-offset-2 sm:self-auto"
          >
            Learn more
          </a>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
