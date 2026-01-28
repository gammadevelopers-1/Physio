"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ChevronDown, Calendar, Clock, Trash2, Video, Lock } from "lucide-react";

// Sample course data for checkout
const checkoutCourse = {
  id: "2",
  title: "Patient Safety & Quality",
  type: "Live Online",
  date: "11 Jan 2026",
  hours: "8 CME Hours",
  price: 460,
  image: "/featured images/Vector 2 (2).svg",
};

export default function CheckoutPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("SA");
  const [isResident, setIsResident] = useState("");
  const [isHealthcarePractitioner, setIsHealthcarePractitioner] = useState("");

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<"credit" | "tabby">("credit");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");
  const [saveInfo, setSaveInfo] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Processing payment...");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-intense)]">
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 bg-[#F8FAFC] px-4 py-6 md:px-16 md:py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link href="/" className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.66667 14.1667H13.3333M9.18141 2.30333L3.52949 6.69927C3.15168 6.99312 2.96278 7.14005 2.82669 7.32405C2.70614 7.48704 2.61633 7.67065 2.56169 7.86588C2.5 8.08627 2.5 8.32558 2.5 8.80421V14.8333C2.5 15.7667 2.5 16.2335 2.68166 16.59C2.84144 16.9036 3.09641 17.1585 3.41002 17.3183C3.76654 17.5 4.23325 17.5 5.16667 17.5H14.8333C15.7668 17.5 16.2335 17.5 16.59 17.3183C16.9036 17.1585 17.1586 16.9036 17.3183 16.59C17.5 16.2335 17.5 15.7667 17.5 14.8333V8.80421C17.5 8.32558 17.5 8.08627 17.4383 7.86588C17.3837 7.67065 17.2939 7.48704 17.1733 7.32405C17.0372 7.14005 16.8483 6.99312 16.4705 6.69927L10.8186 2.30333C10.5258 2.07562 10.3794 1.96177 10.2178 1.91918C10.0752 1.88168 9.92484 1.88168 9.78221 1.91918C9.62057 1.96177 9.47418 2.07562 9.18141 2.30333Z" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <span className="text-[var(--on-surface-variant)]">&gt;</span>
          <Link href="/courses" className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)]">
            Courses
          </Link>
          <span className="text-[var(--on-surface-variant)]">&gt;</span>
          <Link href="/courses/advanced-cardiovascular-life-support" className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)]">
            Advanced Cardiovascular Life Support
          </Link>
          <span className="text-[var(--on-surface-variant)]">&gt;</span>
          <span className="text-[var(--on-surface-default)] font-medium">Buy now</span>
        </nav>

        {/* Main Grid */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Complete Profile Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-[var(--on-surface-default)] mb-4">
                Complete profile
              </h2>

              {/* Alert */}
              <div className="bg-[#FEE2E2] rounded-lg px-4 py-3 mb-6">
                <p className="text-[#DC2626] text-sm">
                  Fill all required profile information
                </p>
              </div>

              {/* Form */}
              <form className="flex flex-col gap-5">
                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[var(--on-surface-default)]">
                      First Name <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full h-12 px-4 bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[var(--on-surface-default)]">
                      Last Name <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full h-12 px-4 bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--on-surface-default)]">
                    Phone number <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[var(--on-surface-default)]">
                      <span className="text-sm">{countryCode}</span>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full h-12 pl-16 pr-4 bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors"
                    />
                  </div>
                </div>

                {/* Resident Question */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--on-surface-default)]">
                    Are you a resident or a citizen of the Kingdom of Saudi Arabia? <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={isResident}
                      onChange={(e) => setIsResident(e.target.value)}
                      className="w-full h-12 px-4 bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors appearance-none cursor-pointer"
                    >
                      <option value=""></option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--on-surface-variant)] pointer-events-none" />
                  </div>
                </div>

                {/* Healthcare Practitioner Question */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--on-surface-default)]">
                    Are you a healthcare practitioner? <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={isHealthcarePractitioner}
                      onChange={(e) => setIsHealthcarePractitioner(e.target.value)}
                      className="w-full h-12 px-4 bg-white border border-[#e5e5e5] rounded-lg outline-none focus:border-[var(--outline-focused)] transition-colors appearance-none cursor-pointer"
                    >
                      <option value=""></option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--on-surface-variant)] pointer-events-none" />
                  </div>
                </div>
              </form>
            </div>

            {/* Course Details Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-[#071437] mb-3">
                Course Details
              </h2>

              {/* Course Card - Vertical Layout matching Figma */}
              <div className="flex flex-col gap-4 w-full max-w-[304px]">
                {/* Course Image Card */}
                <div className="relative bg-[#eef3f7] rounded-2xl overflow-hidden h-[183px] w-full p-4 flex flex-col justify-between">
                  <h3 className="text-lg font-semibold text-[#06080b] leading-normal max-w-[161px] z-10">
                    {checkoutCourse.title}
                  </h3>

                  {/* Image positioned on the right */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[146px] h-[217px]">
                    <Image
                      src={checkoutCourse.image}
                      alt={checkoutCourse.title}
                      fill
                      className="object-contain object-center"
                    />
                  </div>

                  {/* Badge at bottom */}
                  <div className="flex items-center gap-2 bg-[#0B0F17] text-white text-xs px-3 py-1 rounded-full w-fit z-10">
                    <Video className="w-4 h-4" />
                    <span>{checkoutCourse.type}</span>
                  </div>
                </div>

                {/* Date and Hours Badges */}
                <div className="flex gap-4">
                  <div className="flex items-center gap-1 bg-[#f4f4f5] px-2 py-1 rounded-lg text-sm text-[#4a4c4f]">
                    <Calendar className="w-4 h-4" />
                    <span>{checkoutCourse.date}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#f4f4f5] px-2 py-1 rounded-lg text-sm text-[#4a4c4f]">
                    <Clock className="w-4 h-4" />
                    <span>{checkoutCourse.hours}</span>
                  </div>
                </div>

                {/* Price and Delete */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1">
                    <Image
                      src="/icons/rayal-icon.svg"
                      alt="SAR"
                      width={16}
                      height={18}
                      className="-scale-y-100"
                    />
                    <span className="text-lg font-semibold text-[#06080b]">
                      {checkoutCourse.price}
                    </span>
                  </div>
                  <button className="p-2 bg-[#f9fbfd] rounded-xl text-[#4a4c4f] hover:text-[#DC2626] transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Payment */}
          <div className="w-full lg:w-[400px]">
            <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
              <h2 className="text-xl font-semibold text-[var(--on-surface-default)] mb-1">
                Payment
              </h2>
              <p className="text-sm text-[var(--on-surface-variant)] mb-4">
                All transactions are secure and encrypted
              </p>

              {/* Payment Method Selection */}
              <div className="flex flex-col gap-3 mb-4">
                {/* Credit Card Option */}
                <div
                  className={`overflow-hidden cursor-pointer transition-colors ${
                    paymentMethod === "credit"
                      ? "border border-[#005bd3] rounded-xl"
                      : "border border-[#e5e5e5] rounded-xl"
                  }`}
                  onClick={() => setPaymentMethod("credit")}
                >
                  {/* Header - Light grayish-blue when selected (Surface/Container/High) */}
                  <div
                    className={`flex items-center justify-between p-[14px] transition-colors ${
                      paymentMethod === "credit"
                        ? "bg-[#e5edf4] rounded-t-[11px]"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-[11px]">
                      {/* Radio button - thick blue border when selected */}
                      <div
                        className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${
                          paymentMethod === "credit"
                            ? "bg-white border-[6px] border-[#005bd3]"
                            : "border-2 border-[#d5d7da] bg-white"
                        }`}
                      />
                      <span className="font-medium text-[var(--on-surface-default)]">
                        Credit card
                      </span>
                    </div>
                    <div className="flex items-center gap-[11px]">
                      <Image
                        src="/checkout_cart/mada.svg.svg"
                        alt="Mada"
                        width={30}
                        height={10}
                        className="object-contain"
                      />
                      <Image
                        src="/checkout_cart/visa.svg.svg"
                        alt="Visa"
                        width={30}
                        height={18}
                        className="object-contain"
                      />
                      <Image
                        src="/checkout_cart/mastercard.svg.svg"
                        alt="Mastercard"
                        width={30}
                        height={18}
                        className="object-contain"
                      />
                    </div>
                  </div>

                  {/* Credit Card Fields - Surface/Container/Low background */}
                  {paymentMethod === "credit" && (
                    <div
                      className="flex flex-col gap-[14px] p-[14px] bg-[#f9fbfd] border-t border-l border-r border-[#e5edf4]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        placeholder="Card Number"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full h-12 px-[14px] bg-white border border-[#c8d5e1] rounded-lg outline-none focus:border-[#005bd3] transition-colors text-sm placeholder:text-[#c8d5e1]"
                        style={{ boxShadow: "0px 1px 2px 0px rgba(10,13,18,0.05)" }}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="Expiry"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          className="w-full h-12 px-[14px] bg-white border border-[#c8d5e1] rounded-lg outline-none focus:border-[#005bd3] transition-colors text-sm placeholder:text-[#c8d5e1]"
                          style={{ boxShadow: "0px 1px 2px 0px rgba(10,13,18,0.05)" }}
                        />
                        <input
                          type="text"
                          placeholder="CVC"
                          value={cvc}
                          onChange={(e) => setCvc(e.target.value)}
                          className="w-full h-12 px-[14px] bg-white border border-[#c8d5e1] rounded-lg outline-none focus:border-[#005bd3] transition-colors text-sm placeholder:text-[#c8d5e1]"
                          style={{ boxShadow: "0px 1px 2px 0px rgba(10,13,18,0.05)" }}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Name on card"
                        value={nameOnCard}
                        onChange={(e) => setNameOnCard(e.target.value)}
                        className="w-full h-12 px-[14px] bg-white border border-[#c8d5e1] rounded-lg outline-none focus:border-[#005bd3] transition-colors text-sm placeholder:text-[#c8d5e1]"
                        style={{ boxShadow: "0px 1px 2px 0px rgba(10,13,18,0.05)" }}
                      />
                    </div>
                  )}
                </div>

                {/* Tabby Option */}
                <div
                  className={`overflow-hidden cursor-pointer transition-colors ${
                    paymentMethod === "tabby"
                      ? "border border-[#005bd3] rounded-xl"
                      : "border border-[#e5e5e5] rounded-xl"
                  }`}
                  onClick={() => setPaymentMethod("tabby")}
                >
                  <div
                    className={`flex items-center justify-between p-[14px] transition-colors ${
                      paymentMethod === "tabby"
                        ? "bg-[#e5edf4]"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-[11px]">
                      {/* Radio button - thick blue border when selected */}
                      <div
                        className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ${
                          paymentMethod === "tabby"
                            ? "bg-white border-[6px] border-[#005bd3]"
                            : "border-2 border-[#d5d7da] bg-white"
                        }`}
                      />
                      <span className="font-medium text-[var(--on-surface-default)]">
                        Pay later with Tabby
                      </span>
                    </div>
                    <Image
                      src="/checkout_cart/tabby.svg"
                      alt="Tabby"
                      width={60}
                      height={24}
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>

              {/* Save Info Checkbox */}
              <div className="flex items-start gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setSaveInfo(!saveInfo)}
                  className={`w-5 h-5 rounded border flex-shrink-0 mt-0.5 ${
                    saveInfo
                      ? "bg-[#a37f49] border-[#a37f49]"
                      : "bg-white border-[#d5d7da]"
                  } flex items-center justify-center transition-colors`}
                >
                  {saveInfo && (
                    <svg
                      width="12"
                      height="10"
                      viewBox="0 0 12 10"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1 5L4.5 8.5L11 1"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <span className="text-sm text-[var(--on-surface-variant)]">
                  Save my information for a faster checkout with a Shop account
                </span>
              </div>

              {/* Secure Text */}
              <div className="flex items-center justify-center gap-1.5 text-sm text-[var(--on-surface-variant)] mb-4">
                <Lock className="w-4 h-4" />
                <span>Secure and encrypted</span>
              </div>

              {/* Pay Now Button */}
              <button
                onClick={handleSubmit}
                className="w-full h-12 rounded-xl text-white font-medium btn-gold hover:opacity-90 transition-opacity mb-4"
              >
                Pay Now
              </button>

              {/* Secure Payment Footer */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-sm text-[var(--on-surface-variant)]">
                  Secure payment through
                </span>
                <div className="flex items-center gap-1.5">
                  <Image
                    src="/checkout_cart/mastercard.svg.svg"
                    alt="Mastercard"
                    width={24}
                    height={16}
                    className="object-contain"
                  />
                  <Image
                    src="/checkout_cart/visa.svg.svg"
                    alt="Visa"
                    width={24}
                    height={16}
                    className="object-contain"
                  />
                  <Image
                    src="/checkout_cart/mada.svg.svg"
                    alt="Mada"
                    width={24}
                    height={16}
                    className="object-contain"
                  />
                  <Image
                    src="/checkout_cart/applePay.svg.svg"
                    alt="Apple Pay"
                    width={24}
                    height={16}
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
