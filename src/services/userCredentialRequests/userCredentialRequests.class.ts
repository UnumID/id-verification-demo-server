import { Application, Params, Service } from '@feathersjs/feathers';

import { CredentialData, CredentialPb, SubjectCredentialRequests, SubjectCredentialRequestsEnrichedDto } from '@unumid/types';
import { UnumDto, VerifiedStatus, verifySubjectCredentialRequests } from '@unumid/server-sdk';
import { CredentialRequest } from '@unumid/types/build/protos/credential';
import { IssuerEntity } from '../../entities/Issuer';
import logger from '../../logger';
import { UserDto } from '../user/user.class';
import { issueCredentialsHelper } from '../../utils/issueCredentialsHelper';

interface PhoneCredentialSubject extends CredentialData{
  id: string;
  phone: string;
}

interface DobCredentialSubject extends CredentialData{
  id: string;
  dob: string;
}

interface SsnCredentialSubject extends CredentialData{
  id: string;
  ssn: string;
}

export type ValidCredentialTypes = PhoneCredentialSubject | SsnCredentialSubject | DobCredentialSubject;

export type CredentialsIssuedResponse = {
  credentialTypesIssued: string[]
 };

export interface UserCredentialRequests extends SubjectCredentialRequestsEnrichedDto {
  user: UserDto;
}

/**
 * A class to handle SubjectCredentialRequests and issue credentials accordingly, all verification permitting.
 */
export class UserCredentialRequestsService {
  app: Application;

  constructor (app: Application) {
    this.app = app;
  }

  private buildDobCredentialSubject (did: string, dob: string): DobCredentialSubject {
    return {
      id: did,
      type: 'DobCredential',
      dob
    }
  }

  private buildSsnCredentialSubject (did: string, ssn: string): SsnCredentialSubject {
    return {
      id: did,
      type: 'SsnCredential',
      ssn
    }
  }

  private buildPhoneCredentialSubject (did: string, phone: string): PhoneCredentialSubject {
    return {
      id: did,
      type: 'SsnCredential',
      phone
    }
  }

  async create (data: UserCredentialRequests, params?: Params): Promise<CredentialsIssuedResponse> {
    const issuer: IssuerEntity = params?.issuerEntity;

    if (!issuer) {
      throw new Error('No issuer entity found in params. This should never happen after the before hook grabbing the issuer entity.');
    }

    if (!data.credentialRequestsInfo) {
      // short circuit as no requests for credentials
      return {
        credentialTypesIssued: []
      };
    }

    const { user, credentialRequestsInfo: { subjectCredentialRequests, issuerDid, subjectDid } } = data;

    if (issuer.did !== issuerDid) {
      throw new Error(`Persisted Issuer DID ${issuer.did} does not match request's issuer did ${issuerDid}`);
    }

    const verification: UnumDto<VerifiedStatus> = await verifySubjectCredentialRequests(issuer.authToken, issuer.did, subjectDid, subjectCredentialRequests);

    if (!verification.body.isVerified) {
      logger.error(`SubjectCredentialRequests could not be validated. Not issuing credentials. ${verification.body.message}`);
      throw new Error(`SubjectCredentialRequests could not be validated. Not issuing credentials. ${verification.body.message}`);
    }

    // Note in the userDidAssociation hook we have already ensured that the user has an associated did.
    const userDid = user.did as string;

    /**
     * Now that we have verified the credential requests signature signed by the subject, aka user, and we
     * have confirmed to have a user with the matching did in our data store, we need some logic to determine if we can
     * issue the requested credentials.
     *
     * For demonstration purposes just simply full-filling email, kyc and auth credential requests.
     */
    const credentialSubjects: ValidCredentialTypes[] = [];
    subjectCredentialRequests.credentialRequests.forEach((credentialRequest: CredentialRequest) => {
      if (credentialRequest.type === 'DobCredential') {
        credentialSubjects.push(this.buildDobCredentialSubject(userDid, user.dob));
      } else if (credentialRequest.type === 'SsnCredential') {
        credentialSubjects.push(this.buildSsnCredentialSubject(userDid, user.ssn));
      } else if (credentialRequest.type === 'PhoneCredential') {
        credentialSubjects.push(this.buildPhoneCredentialSubject(userDid, user.phone));
      }
    });

    const issuerDto: UnumDto<CredentialPb[]> = await issueCredentialsHelper(issuer, userDid, credentialSubjects);

    // update the default issuer's auth token if it has been reissued
    if (issuerDto.authToken !== issuer.authToken) {
      const issuerDataService = this.app.service('issuerData');
      try {
        await issuerDataService.patch(issuer.uuid, { authToken: issuerDto.authToken });
      } catch (e) {
        logger.error('CredentialRequest create caught an error thrown by issuerDataService.patch', e);
        throw e;
      }
    }

    return {
      credentialTypesIssued: credentialSubjects.map((credentialSubject: ValidCredentialTypes) => credentialSubject.type)
    };
  }
}