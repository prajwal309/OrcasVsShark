"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";

const AccountContext = createContext<{
  username: string | null;
  setUsername: (username: string | null) => void;
} | null>(null);

export function AccountProvider({
  children,
  initialUsername,
}: {
  children: ReactNode;
  initialUsername: string | null;
}) {
  const [username, setUsername] = useState(initialUsername);

  return (
    <AccountContext.Provider value={{ username, setUsername }}>
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
      title={username ?? undefined}
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
