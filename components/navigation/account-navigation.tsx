"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";

const AccountContext = createContext<{
  username: string | null;
  isGuest: boolean;
  setUsername: (username: string | null) => void;
  setIsGuest: (isGuest: boolean) => void;
} | null>(null);

export function AccountProvider({
  children,
  initialUsername,
  initialIsGuest = false,
}: {
  children: ReactNode;
  initialUsername: string | null;
  initialIsGuest?: boolean;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [isGuest, setIsGuest] = useState(initialIsGuest);

  return (
    <AccountContext.Provider
      value={{ username, isGuest, setUsername, setIsGuest }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error("AccountProvider is required.");
  return account;
}

export function AccountLink({
  room,
  inLobby = false,
}: {
  room?: string;
  inLobby?: boolean;
}) {
  const { username } = useAccount();
  const lobby = room ? `/online?room=${room}` : "/online";
  const href = inLobby ? "#online-account" : lobby;
  return (
    <Link
      className="account-link"
      href={href}
      aria-label={username ?? "Login"}
      title={username ?? "Login"}
      data-signed-in={username ? "" : undefined}
    >
      <svg
        viewBox="0 0 20 20"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="10" cy="6" r="3" />
        <path d="M4 17v-1a6 6 0 0 1 12 0v1" strokeLinecap="round" />
      </svg>
      <span>{username ?? "Login"}</span>
    </Link>
  );
}
