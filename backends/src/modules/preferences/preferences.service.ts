import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { userPreferences } from '../../database/schema';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { UpdateUiPrefsDto } from './dto/update-ui-prefs.dto';
import { UpdatePolicyPrefsDto } from './dto/update-policy-prefs.dto';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  /**
   * Get preferences for a user. Creates default record if none exists.
   */
  async getPreferences(userId: string) {
    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Create with defaults
    const [created] = await db
      .insert(userPreferences)
      .values({ userId })
      .returning();

    return created;
  }

  /**
   * Update notification preferences.
   */
  async updateNotifications(userId: string, dto: UpdateNotificationPrefsDto) {
    // Ensure record exists
    await this.getPreferences(userId);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.emailNewStudent !== undefined) updateData.emailNewStudent = dto.emailNewStudent;
    if (dto.emailCourseComplete !== undefined) updateData.emailCourseComplete = dto.emailCourseComplete;
    if (dto.emailAssessmentSubmit !== undefined) updateData.emailAssessmentSubmit = dto.emailAssessmentSubmit;
    if (dto.emailCertificateRequest !== undefined) updateData.emailCertificateRequest = dto.emailCertificateRequest;
    if (dto.pushNewSession !== undefined) updateData.pushNewSession = dto.pushNewSession;
    if (dto.pushStudentMessage !== undefined) updateData.pushStudentMessage = dto.pushStudentMessage;
    if (dto.pushSystemUpdates !== undefined) updateData.pushSystemUpdates = dto.pushSystemUpdates;
    if (dto.digestWeekly !== undefined) updateData.digestWeekly = dto.digestWeekly;
    if (dto.digestMonthly !== undefined) updateData.digestMonthly = dto.digestMonthly;
    if (dto.reminderMinutes !== undefined) updateData.reminderMinutes = dto.reminderMinutes;

    const [updated] = await db
      .update(userPreferences)
      .set(updateData)
      .where(eq(userPreferences.userId, userId))
      .returning();

    return updated;
  }

  /**
   * Update UI preferences.
   */
  async updateUiPreferences(userId: string, dto: UpdateUiPrefsDto) {
    // Ensure record exists
    await this.getPreferences(userId);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.theme !== undefined) updateData.theme = dto.theme;
    if (dto.dateFormat !== undefined) updateData.dateFormat = dto.dateFormat;
    if (dto.timeFormat !== undefined) updateData.timeFormat = dto.timeFormat;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.defaultView !== undefined) updateData.defaultView = dto.defaultView;
    if (dto.compactMode !== undefined) updateData.compactMode = dto.compactMode;
    if (dto.showTips !== undefined) updateData.showTips = dto.showTips;
    if (dto.highContrast !== undefined) updateData.highContrast = dto.highContrast;
    if (dto.fontSize !== undefined) updateData.fontSize = dto.fontSize;
    if (dto.reduceMotion !== undefined) updateData.reduceMotion = dto.reduceMotion;
    if (dto.contentLanguage !== undefined) updateData.contentLanguage = dto.contentLanguage;
    if (dto.calendarFormat !== undefined) updateData.calendarFormat = dto.calendarFormat;
    if (dto.captionsDefault !== undefined) updateData.captionsDefault = dto.captionsDefault;
    if (dto.subtitlesLanguage !== undefined) updateData.subtitlesLanguage = dto.subtitlesLanguage;
    if (dto.profileVisibility !== undefined) updateData.profileVisibility = dto.profileVisibility;
    if (dto.dataSharing !== undefined) updateData.dataSharing = dto.dataSharing;

    const [updated] = await db
      .update(userPreferences)
      .set(updateData)
      .where(eq(userPreferences.userId, userId))
      .returning();

    return updated;
  }

  /**
   * Update default policy preferences.
   */
  async updatePolicies(userId: string, dto: UpdatePolicyPrefsDto) {
    await this.getPreferences(userId);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.policyEnrollmentLimit !== undefined) updateData.policyEnrollmentLimit = dto.policyEnrollmentLimit;
    if (dto.policyRequireContentReview !== undefined) updateData.policyRequireContentReview = dto.policyRequireContentReview;
    if (dto.policyAutoApproveCertificates !== undefined) updateData.policyAutoApproveCertificates = dto.policyAutoApproveCertificates;
    if (dto.policyCancellationNoticeHours !== undefined) updateData.policyCancellationNoticeHours = dto.policyCancellationNoticeHours;
    if (dto.policyMaxInstructorWeeklyHours !== undefined) updateData.policyMaxInstructorWeeklyHours = dto.policyMaxInstructorWeeklyHours;
    if (dto.policyEnforceNelcCompliance !== undefined) updateData.policyEnforceNelcCompliance = dto.policyEnforceNelcCompliance;

    const [updated] = await db
      .update(userPreferences)
      .set(updateData)
      .where(eq(userPreferences.userId, userId))
      .returning();

    return updated;
  }
}
