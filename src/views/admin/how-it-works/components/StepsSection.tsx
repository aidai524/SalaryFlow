export function StepsSection() {
  return (
    <section id="how-confidential-payments-work-on-decash" className="scroll-mt-6">
      <h2 className="font-montserrat text-[26px] font-semibold leading-tight text-black">
        How Confidential Payments Work on Stableflow Pay
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
          <h3 className="font-montserrat text-[16px] font-semibold text-black">
            You Define the Payment
          </h3>
          <div className="mt-4 space-y-3 font-montserrat text-[14px] leading-normal text-black">
            <p>Choose the recipient, amount, and what they should receive.</p>
            <p>
              Your payment source and the recipient&apos;s destination can use
              different supported networks and assets.
            </p>
          </div>
        </div>

        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
          <h3 className="font-montserrat text-[16px] font-semibold text-black">
            The Intent Executes Confidentially
          </h3>
          <div className="mt-4 space-y-3 font-montserrat text-[14px] leading-normal text-black">
            <p>
              Stableflow Pay uses{" "}
              <span className="font-semibold">NEAR Confidential Intents</span>, where
              execution happens inside a dedicated NEAR private shard.
            </p>
            <p>
              The private shard is connected to NEAR mainnet through a TEE-based
              bridge.
            </p>
          </div>
        </div>

        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
          <h3 className="font-montserrat text-[16px] font-semibold text-black">
            The Recipient Gets Paid
          </h3>
          <div className="mt-4 space-y-3 font-montserrat text-[14px] leading-normal text-black">
            <p>
              The recipient receives the requested asset on their destination network.
            </p>
            <p>
              The payment does not create the same direct public sender ↔ recipient
              relationship as a standard wallet-to-wallet transfer.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-5 font-montserrat text-[14px] leading-normal text-black">
        *Source and destination networks may still have their own public on-chain
        activity. Stableflow Pay protects the direct payment relationship, not the entire
        blockchain.
      </p>
    </section>
  );
}
