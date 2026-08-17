export function HeroSection() {
  return (
    <section id="how-confidential-payments-work" className="scroll-mt-6">
      <h1 className="font-montserrat text-[26px] font-semibold leading-tight text-black">
        How Confidential Payments Work
      </h1>
      <p className="mt-5 font-montserrat text-[16px] font-semibold text-black">
        Your keys. Your funds. Confidential by default.
      </p>
      <div className="mt-5 space-y-4 font-montserrat text-[16px] leading-normal text-black">
        <p>
          Stableflow Pay uses confidential execution to reduce the public link between the
          wallet you pay from and the wallet that receives your payment.
        </p>
        <p>
          Send stablecoins across supported chains and assets while keeping payment
          relationships confidential by default.
        </p>
      </div>

      <div className="mt-8 rounded-[20px] border border-white bg-[#fdfdfd] px-4 py-6 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:px-8 sm:py-8">
        <p className="mb-6 font-montserrat text-[16px] font-semibold text-black">
          How a Stableflow Pay Payment Works
        </p>
        <div className="flex flex-col items-center md:items-start gap-6 sm:flex-row sm:justify-center sm:gap-0">
          <div className="flex flex-col items-center gap-2">
            <img
              src="/howitwork/how-a-decash-payment-works-your-wallet.png"
              alt=""
              className="size-[60px] object-contain"
            />
            <p className="font-montserrat text-[14px] font-medium text-black">Your Wallet</p>
          </div>

          <img
            src="/howitwork/how-a-decash-payment-works-arrow-to-right.png"
            alt=""
            className="hidden h-[15px] w-[60px] shrink-0 translate-y-[20px] object-contain sm:mx-3 sm:block md:mx-5"
            aria-hidden
          />
          <img
            src="/howitwork/how-a-decash-payment-works-arrow-to-right.png"
            alt=""
            className="h-[15px] w-[40px] rotate-90 object-contain sm:hidden"
            aria-hidden
          />

          <div className="flex flex-col items-center gap-2">
            <img
              src="/howitwork/how-a-decash-payment-works-confidential-execution.png"
              alt=""
              className="h-[58px] w-[49px] object-contain"
            />
            <p className="font-montserrat text-[14px] font-medium text-black">
              Confidential execution
            </p>
            <p className="max-w-[212px] text-center font-montserrat text-[12px] leading-normal text-black">
              No direct public on-chain link between sender and recipient.
            </p>
          </div>

          <img
            src="/howitwork/how-a-decash-payment-works-arrow-to-left.png"
            alt=""
            className="hidden h-[15px] w-[60px] shrink-0 translate-y-[20px] object-contain sm:mx-3 sm:block md:mx-5"
            aria-hidden
          />
          <img
            src="/howitwork/how-a-decash-payment-works-arrow-to-left.png"
            alt=""
            className="h-[15px] w-[40px] rotate-90 object-contain sm:hidden"
            aria-hidden
          />

          <div className="flex flex-col items-center gap-2">
            <img
              src="/howitwork/how-a-decash-payment-works-recipient-wallet.png"
              alt=""
              className="size-[60px] object-contain"
            />
            <p className="font-montserrat text-[14px] font-medium text-black">
              Recipient Wallet
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
