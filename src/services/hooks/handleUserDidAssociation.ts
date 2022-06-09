import { BadRequest } from '@feathersjs/errors';
import { Hook } from '@feathersjs/feathers';
import { issueCredentials, revokeAllCredentials, UnumDto, VerifiedStatus, verifySignedDid } from '@unumid/server-sdk';
import { CredentialPb, SubjectCredentialRequestsDto, SubjectCredentialRequestsEnrichedDto } from '@unumid/types';
import { IssuerEntity } from '../../entities/Issuer';
import logger from '../../logger';
import { issueUserCredentials } from '../../utils/issueUserCredentials';
import { UserDto } from '../user/user.class';

/**
 * Grab and return the associated user. If useDidAssociation is passed update the user with the provided did.
 * @param ctx
 * @returns
 */
export const handleUserDidAssociation: Hook = async (ctx) => {
  const { app, params } = ctx;

  // need to get an existing user either by the userIdentifier or by the subjectDid
  const userEntityService = app.service('userEntity');
  let user: UserDto;

  const issuer: IssuerEntity = params?.issuerEntity;
  const { credentialRequestsInfo, userDidAssociation }: SubjectCredentialRequestsEnrichedDto = ctx.data;

  // if no userDidAssociation as part of request body then it is assume this issuer already has the did associated with a user
  if (!userDidAssociation) {
    logger.debug('No new userDidAssociation in the userCredentialRequests');

    // ensuring credentialRequestsInfo must be present it userDidAssociation is not in the validation before hook validateUserCredentialRequest
    const subjectDid = credentialRequestsInfo?.subjectDid;

    // grabbing user by subjectDid
    try {
      user = await userEntityService.get(null, { where: { did: subjectDid } }); // will throw exception if not found
    } catch (e) {
      logger.warn(`No user found with did ${subjectDid}. This should never happen.`);
      throw e;
    }

    return {
      ...ctx,
      data: {
        ...ctx.data,
        user
      }
    };
  }

  const { userCode, did, issuerDid } = userDidAssociation;

  if (issuerDid !== issuer.did) {
    throw new BadRequest(`Invalid issuerDid ${issuerDid} in userCredentialRequests.userDidAssociation.issuer ${issuer.did}`);
  }

  try {
    user = await userEntityService.get(null, { where: { userCode } }); // will throw exception if not found
  } catch (e) {
    logger.warn(`No user found with code ${userCode}. Can not associate the did ${did.id}.`);
    throw e;
  }

  // verify the subject did document
  const result: UnumDto<VerifiedStatus> = await verifySignedDid(issuer.authToken, issuer.did, did);

  if (!result.body.isVerified) {
    throw new Error(`${result.body.message} Subject DID document ${did.id} for user ${userCode} is not verified.`);
  }

  const userDid = did.id;

  // if this is a new DID association for the user then we need to revoke all the credentials associated with teh old did document
  if (userDid !== user.did) {
    if (user.did) {
      // revoke all credentials associated with old did
      await revokeAllCredentials(issuer.authToken, issuer.did, issuer.signingPrivateKey, user.did);
    }

    // update the user with the new DID
    user = await userEntityService.patch(user.uuid, { did: userDid, userCode: null });

    // now that the user has a DID we can issue credentials for the user
    const issuedCredentialDto: UnumDto<CredentialPb[]> = await issueUserCredentials(user, issuer);

    // update the default issuer's auth token if it has been reissued
    if (issuedCredentialDto.authToken !== issuer.authToken) {
      const userEntityService = ctx.app.service('issuerEntity');
      try {
        await userEntityService.patch(issuer.uuid, { authToken: issuedCredentialDto.authToken });
      } catch (e) {
        logger.error('CredentialRequest create caught an error thrown by userEntityService.patch', e);
        throw e;
      }
    }
  } else {
    logger.debug('User association information sent with identical user did information.');
    user = await userEntityService.patch(user.uuid, { userCode: null }); // remove the userCode from the user
  }

  // update the default issuer's auth token if it has been reissued
  if (result.authToken !== issuer.authToken) {
    const issuerEntityService = app.service('issuerEntity');
    try {
      await issuerEntityService.patch(issuer.uuid, { authToken: result.authToken });
    } catch (e) {
      logger.error('CredentialRequest create caught an error thrown by issuerEntityService.patch', e);
      throw e;
    }
  }

  return {
    ...ctx,
    data: {
      ...ctx.data,
      user
    }
  };
};
