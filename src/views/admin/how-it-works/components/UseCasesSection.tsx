function ControlCallout() {
  return (
    <div className="mt-5 rounded-[12px] border border-primary bg-primary/20 px-5 py-5 sm:px-6 sm:py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,314px)_1fr] lg:items-center lg:gap-8">
        <div>
          <h3 className="font-montserrat text-[16px] font-semibold text-black">
            You stay in control
          </h3>
          <p className="mt-2 font-montserrat text-[14px] leading-normal text-black">
            Stableflow Pay is non-custodial. You authorize every payment from your own wallet
            or Safe.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-end sm:gap-2">
          <div className="flex w-full max-w-[140px] flex-col items-center gap-2 text-center sm:max-w-[116px]">
            <img
              src="/howitwork/you-authorizethe-payment.png"
              alt=""
              className="h-[26px] w-[33px] object-contain sm:-translate-y-3"
            />
            <p className="font-montserrat text-[12px] leading-normal text-black">
              You authorize the payment
            </p>
          </div>

          <img
            src="/howitwork/you-stay-in-control-arrow-right.png"
            alt=""
            className="hidden h-3 w-12 shrink-0 object-contain sm:block sm:-translate-y-[62px]"
            aria-hidden
          />
          <img
            src="/howitwork/you-stay-in-control-arrow-right.png"
            alt=""
            className="h-3 w-10 rotate-90 object-contain sm:hidden"
            aria-hidden
          />

          <div className="flex w-full max-w-[140px] flex-col items-center gap-2 text-center sm:max-w-[136px]">
            <img
              src="/howitwork/decash-executes-confidentialy.png"
              alt=""
              className="h-[50px] w-[43px] object-contain"
            />
            <p className="font-montserrat text-[12px] leading-normal text-black">
              Stableflow Pay executes confidentialy
            </p>
          </div>

          <img
            src="/howitwork/you-stay-in-control-arrow-right.png"
            alt=""
            className="hidden h-3 w-12 shrink-0 object-contain sm:block sm:-translate-y-[62px]"
            aria-hidden
          />
          <img
            src="/howitwork/you-stay-in-control-arrow-right.png"
            alt=""
            className="h-3 w-10 rotate-90 object-contain sm:hidden"
            aria-hidden
          />

          <div className="flex w-full max-w-[140px] flex-col items-center gap-2 text-center">
            <img
              src="/howitwork/funds-move-according-to-your-instruction.png"
              alt=""
              className="h-[30px] w-[32px] object-contain sm:-translate-y-3"
            />
            <p className="font-montserrat text-[12px] leading-normal text-black">
              Funds move according to your instruction
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UseCasesSection() {
  return (
    <section id="built-for-more-than-payroll" className="scroll-mt-6">
      <h2 className="font-montserrat text-[26px] font-semibold leading-tight text-black">
        Built for More Than Payroll
      </h2>
      <p className="mt-3 font-montserrat text-[16px] text-black">
        One confidential payment layer. Many ways to use it.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-4">
            <img
              src="/howitwork/personal-payments.png"
              alt=""
              className="h-[39px] w-[44px] shrink-0 object-contain"
            />
            <div>
              <h3 className="font-montserrat text-[16px] font-semibold text-black">
                Personal Payments
              </h3>
              <p className="mt-2 font-montserrat text-[14px] leading-normal text-black">
                Pay another wallet without exposing a direct public relationship
                between your wallets.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-4">
            <img
              src="/howitwork/payroll.png"
              alt=""
              className="h-10 w-[38px] shrink-0 object-contain"
            />
            <div>
              <h3 className="font-montserrat text-[16px] font-semibold text-black">
                Payroll
              </h3>
              <p className="mt-2 font-montserrat text-[14px] leading-normal text-black">
                Pay employees without exposing a public treasury → employee salary
                graph.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-4">
            <img
              src="/howitwork/contractors-vendors.png"
              alt=""
              className="h-10 w-[35px] shrink-0 object-contain"
            />
            <div>
              <h3 className="font-montserrat text-[16px] font-semibold text-black">
                Contractors & Vendors
              </h3>
              <p className="mt-2 font-montserrat text-[14px] leading-normal text-black">
                Keep commercial payment relationships and recurring payouts less
                publicly linkable.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-4">
            <img
              src="/howitwork/cross-chain-payments.png"
              alt=""
              className="h-10 w-[44px] shrink-0 object-contain"
            />
            <div>
              <h3 className="font-montserrat text-[16px] font-semibold text-black">
                Cross-Chain Payments
              </h3>
              <p className="mt-2 font-montserrat text-[14px] leading-normal text-black">
                Pay from the asset you hold while the recipient receives the stablecoin
                and network they prefer.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ControlCallout />
    </section>
  );
}
