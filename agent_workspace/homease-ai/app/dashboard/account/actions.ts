'use server'
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(prevState: any, formData: FormData) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { message: 'Authentication required.' };
  }

  const fullName = formData.get('fullName') as string;

  const { error } = await supabase.from('profiles').update({
    full_name: fullName,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  if (error) {
    console.error('Update profile error:', error);
    return { message: 'Failed to update profile.' };
  }

  revalidatePath('/dashboard/account'); // Re-renders the page with new data
  return { message: 'Profile updated successfully!' };
}
