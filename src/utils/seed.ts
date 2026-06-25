import { 
  db, 
  auth, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query,
  where,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  handleFirestoreError,
  OperationType
} from '../firebase';

export async function seedInitialUsers() {
  const systemConfigRef = doc(db, 'system', 'config');
  let systemConfigSnap;
  
  try {
    systemConfigSnap = await getDoc(systemConfigRef);
  } catch (err: any) {
    if (err.code === 'permission-denied' || err.message?.includes('permission')) {
      handleFirestoreError(err, OperationType.GET, 'system/config');
    }
    throw err;
  }
  
  try {
    if (systemConfigSnap.exists() && systemConfigSnap.data().seeded) {
      console.log('Database already seeded.');
      return { success: true, message: 'Already seeded' };
    }

    console.log('Seeding initial users...');

    // The default users to seed
    const seedUsers = [
      {
        email: 'ITM@astoncirebon.com',
        password: 'aston123',
        name: 'IT Manager ASTON',
        role: 'admin' as const
      },
      {
        email: 'admin@aston.com',
        password: 'aston123',
        name: 'Admin Luggage',
        role: 'admin' as const
      },
      {
        email: 'staff@aston.com',
        password: 'aston123',
        name: 'Staff Luggage',
        role: 'staff' as const
      }
    ];

    let authOperationNotAllowed = false;
    for (const u of seedUsers) {
      try {
        // Create in Firebase Auth
        const credential = await createUserWithEmailAndPassword(auth, u.email, u.password);
        const uid = credential.user.uid;

        // Save to Firestore 'users' collection
        try {
          await setDoc(doc(db, 'users', uid), {
            uid,
            email: u.email,
            name: u.name,
            role: u.role,
            createdAt: new Date().toISOString()
          });
        } catch (err: any) {
          if (err.code === 'permission-denied' || err.message?.includes('permission')) {
            handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
          }
          throw err;
        }
        
        console.log(`Seeded user: ${u.email}`);
      } catch (authError: any) {
        // If user already exists in auth, just log and continue
        if (authError.code === 'auth/email-already-in-use') {
          console.log(`User ${u.email} already exists in Auth. Ensuring Firestore record exists by signing in.`);
          try {
            const credential = await signInWithEmailAndPassword(auth, u.email, u.password);
            const uid = credential.user.uid;
            
            try {
              await setDoc(doc(db, 'users', uid), {
                uid,
                email: u.email,
                name: u.name,
                role: u.role,
                createdAt: new Date().toISOString()
              });
              console.log(`Ensured Firestore record for existing Auth user: ${u.email}`);
            } catch (err: any) {
              if (err.code === 'permission-denied' || err.message?.includes('permission')) {
                handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
              }
              throw err;
            }
          } catch (signInErr: any) {
            console.error(`Failed to sign in and ensure Firestore record for existing user ${u.email}:`, signInErr);
          }
        } else if (authError.code === 'auth/operation-not-allowed') {
          console.error(`Error seeding ${u.email}: Email/Password provider is not enabled in Firebase Console.`);
          authOperationNotAllowed = true;
        } else {
          console.error(`Error seeding ${u.email}:`, authError);
        }
      }
    }

    if (authOperationNotAllowed) {
      return { 
        success: false, 
        error: 'auth/operation-not-allowed', 
        message: 'Provider Email/Password belum diaktifkan di Firebase Console Anda. Silakan buka Firebase Console -> Authentication -> Sign-in method, lalu aktifkan provider Email/Password.'
      };
    }

    // Set seeded flag
    try {
      await setDoc(systemConfigRef, { seeded: true }, { merge: true });
    } catch (err: any) {
      if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        handleFirestoreError(err, OperationType.WRITE, 'system/config');
      }
      throw err;
    }
    
    // Sign out any automatically logged-in user from the seeding process
    await auth.signOut();

    return { success: true, message: 'Successfully seeded default users!' };
  } catch (error: any) {
    console.error('Seeding system error:', error);
    return { success: false, error: error.message };
  }
}
