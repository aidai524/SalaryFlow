export function ProblemSection() {
  return (
    <section id="the-problem-with-normal-on-chain-payments" className="scroll-mt-6">
      <h2 className="font-montserrat text-[26px] font-semibold leading-tight text-black">
        The Problem With Normal On-Chain Payments
      </h2>
      <div className="mt-5 space-y-4 font-montserrat text-[16px] leading-normal text-black">
        <p>
          A normal stablecoin transfer creates a permanent public relationship between
          two wallets.
        </p>
        <p>
          Anyone inspecting the blockchain can see the sending address and receiving
          address and use public activity to analyze the relationship between them.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="flex items-center gap-3">
              <img
                src="/howitwork/for-businesses.png"
                alt=""
                className="h-[18px] w-[19px] object-contain"
              />
              <h3 className="font-montserrat text-[16px] font-semibold text-black">
                For businesses
              </h3>
            </div>
            <p className="mt-3 font-montserrat text-[14px] leading-normal text-black">
              This can expose salary relationships, treasury activity, and vendor
              relationships.
            </p>
          </div>

          <div className="flex-1 rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="flex items-center gap-3">
              <img
                src="/howitwork/for-individuals.png"
                alt=""
                className="h-5 w-[19px] object-contain"
              />
              <h3 className="font-montserrat text-[16px] font-semibold text-black">
                For individuals
              </h3>
            </div>
            <p className="mt-3 font-montserrat text-[14px] leading-normal text-black">
              This can expose which wallet paid whom and make it easier to inspect
              related wallet activity.
            </p>
          </div>
        </div>

        <div className="rounded-[20px] border border-white bg-[#fdfdfd] p-5 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:p-6">
          <h3 className="font-montserrat text-[16px] font-semibold text-black">
            Standard payment
          </h3>
          <div className="mt-6 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 rounded-[12px] border border-primary bg-primary/20 px-3.5 py-2.5">
              <img
                src="/howitwork/standard-payment-your-wallet.png"
                alt=""
                className="h-4 w-[15px] object-contain"
              />
              <span className="font-montserrat text-[14px] font-medium text-black">
                Your Wallet
              </span>
            </div>

            <div className="relative my-1 flex h-[60px] w-full max-w-[300px] items-center justify-center">
              <img
                src="/howitwork/standard-payment-arrow-to-down.png"
                alt=""
                className="h-[52px] w-[15px] object-contain"
                aria-hidden
              />
              <span
                className="absolute left-1/2 top-1/2 z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3F8AFB]"
                aria-hidden
              />
              <div className="absolute left-[calc(50%+10px)] top-1/2 z-10 flex h-[28px] w-[154px] -translate-y-1/2 items-center justify-center">
                <img
                  src="/howitwork/public-transaction-bg.png"
                  alt=""
                  className="absolute inset-0 size-full object-fill"
                  aria-hidden
                />
                <span className="relative z-10 pl-3 font-montserrat text-[14px] font-medium text-white">
                  Public transaction
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-[12px] border border-primary bg-primary/20 px-3.5 py-2.5">
              <img
                src="/howitwork/standard-payment-recipient-wallet.png"
                alt=""
                className="h-[15px] w-[18px] object-contain"
              />
              <span className="font-montserrat text-[14px] font-medium text-black">
                Recipient Wallet
              </span>
            </div>

            <div className="mt-5 text-center font-montserrat text-[14px] font-medium leading-normal text-[#9fa7ba]">
              <p className="inline-flex items-center gap-1.5">
                <span>Sender</span>
                <img
                  src="/howitwork/standard-payment-arrow-to-right.png"
                  alt=""
                  className="h-[15px] w-[16px] object-contain"
                  aria-hidden
                />
                <span>recipient directly</span>
              </p>
              <p>linked on-chain</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
