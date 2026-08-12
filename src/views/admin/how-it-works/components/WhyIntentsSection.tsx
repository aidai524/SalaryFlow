export function WhyIntentsSection() {
  return (
    <section id="why-confidential-intents" className="scroll-mt-6">
      <h2 className="font-montserrat text-[26px] font-semibold leading-tight text-black">
        Why Confidential Intents
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
          <h3 className="font-montserrat text-[16px] font-semibold text-black">
            Confidential Execution
          </h3>
          <div className="mt-4 space-y-3 font-montserrat text-[14px] leading-normal text-black">
            <p>
              Execution happens without exposing details to the public mempool or bots.
            </p>
            <p>
              Your payment relationships and execution details stay confidential.
            </p>
          </div>
        </div>

        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
          <h3 className="font-montserrat text-[16px] font-semibold text-black">
            Cross-Chain by Design
          </h3>
          <div className="mt-4 space-y-3 font-montserrat text-[14px] leading-normal text-black">
            <p>
              Pay with one supported asset or network and deliver another supported
              asset on the recipient&apos;s preferred network.
            </p>
            <p>True cross-chain payments, simplified.</p>
          </div>
        </div>

        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
          <h3 className="font-montserrat text-[16px] font-semibold text-black">
            Selective Disclosure
          </h3>
          <div className="mt-4 space-y-3 font-montserrat text-[14px] leading-normal text-black">
            <p>Confidential doesn&apos;t mean unauditable.</p>
            <p>
              Selective disclosure and auditable execution allow the right information
              to be shared when needed.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 font-montserrat text-[14px] leading-normal text-black">
        *Powered by NEAR Confidential Intents
      </p>
    </section>
  );
}
