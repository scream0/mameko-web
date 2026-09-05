// @ts-nocheck
import React from "react";
import styles from "./UserProfil.module.css";
import profileConfig from "@/data/ui/userProfilConfig.json";

export default function ProfileHeader({ profile }) {
  return (
    <div className={`card ${styles.sectionHeaderCard}`}>
      <div className={styles.headerCardInner}>
        <div className={styles.avatar}>
          {profile?.photoURL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={profile.photoURL} alt="Avatar" />
          ) : (
            <span>👤</span>
          )}
        </div>
        <div>
          <h3 className={styles.headerName}>
            {profile?.fullName || profile?.username || profileConfig.header.fallbackUserName}
          </h3>
          <p className={styles.headerRole}>
            {profile?.email || profileConfig.header.fallbackEmail}
          </p>
        </div>
      </div>
    </div>
  );
}