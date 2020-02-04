import test from 'ava'
import request from 'supertest'
import { server, appReady } from '../../../server'
import Organisation from '../organisation'
import MemoryMongo from '../../../util/test-memory-mongo'
import orgs from './organisation.fixture.js'
import { Role } from '../../../services/authorize/role'
import Person from '../../../../server/api/person/person'
import jsonwebtoken from 'jsonwebtoken'
import uuid from 'uuid'
import { jwtData } from '../../../../server/middleware/session/__tests__/setSession.fixture'
import { MemberStatus } from '../../member/member.constants'
import Member from '../../member/member'

test.before('before connect to database', async (t) => {
  t.context.memMongo = new MemoryMongo()
  await t.context.memMongo.start()
  await appReady
  await Organisation.create(orgs).catch(() => 'Unable to create orgs')
})

test.after.always(async (t) => {
  await t.context.memMongo.stop()
})

const endpointUrl = '/api/organisations'

const createJwtIdToken = (email) => {
  const jwt = { ...jwtData }
  jwt.idTokenPayload.email = email

  return jsonwebtoken.sign(jwt.idTokenPayload, 'secret')
}

const createPerson = (roles) => {
  // Create a new user in the database directly
  const person = {
    name: 'name',
    email: `${uuid()}@test.com`,
    role: roles || [],
    status: 'active'
  }

  return Person.create(person)
}

const createPersonAndGetToken = async (roles) => {
  const user = await createPerson(roles)

  if (!roles) {
    return undefined
  } else {
    // Create a JWT token to use in our HTTP header
    return createJwtIdToken(user.email)
  }
}

const createOrganisation = () => {
  // Create a new organisation directly in the database
  return Organisation.create({
    name: 'Test org',
    slug: 'test-organisation',
    category: ['vp']
  })
}

const applyHeaders = (request, jwtIdToken) => {
  request = request
    .set('Accept', 'application/json')

  // Set the authentiction header if supplied, otherwise the request will be anonymous
  if (jwtIdToken) {
    request = request.set('Cookie', [`idToken=${jwtIdToken}`])
  }

  return request
}

// Test organisation permissions/abilities
test.serial('Permissions - Roles matrix', async t => {
  const getAll = async (roles) => {
    let req = request(server).get(endpointUrl)
    req = applyHeaders(req, await createPersonAndGetToken(roles))
    return req.send()
  }
  const getById = async (roles) => {
    const org = await createOrganisation()
    let req = request(server).get(`${endpointUrl}/${org._id}`)
    req = applyHeaders(req, await createPersonAndGetToken(roles))
    return req.send()
  }
  const delete_ = async (roles) => {
    // Create an organisation and then DELETE it by ID
    const org = await createOrganisation()

    let req = request(server).delete(`${endpointUrl}/${org._id}`)
    req = applyHeaders(req, await createPersonAndGetToken(roles))
    return req.send()
  }
  const post = async (roles) => {
    let req = request(server).post(endpointUrl)
    req = applyHeaders(req, await createPersonAndGetToken(roles))
    return req.send({
      name: 'Test org - POST',
      slug: 'test-organisation',
      category: ['vp']
    })
  }
  const put = async (roles) => {
    // Create an organisation and update its details with a PUT request using its ID
    const org = await createOrganisation()

    const jwtIdToken = await createPersonAndGetToken(roles)

    let req = request(server).put(`${endpointUrl}/${org._id}`)
    req = applyHeaders(req, jwtIdToken)
    return req.send({
      name: 'Test org - PUT',
      slug: 'test-organisation',
      category: ['vp']
    })
  }

  // All roles and their allowed and disallowed REST operations
  //
  // Each REST operation will create a new user, authenticate as that user, create a new organisation and perform
  // the HTTP call and assert the response code
  const matrix = [
    {
      roles: [Role.ADMIN],
      permitted: [getAll, getById, delete_, post, put],
      forbidden: []
    },
    {
      roles: [Role.TESTER],
      permitted: [getAll, getById],
      forbidden: [delete_, post, put]
    },
    {
      roles: [Role.ACTIVITY_PROVIDER],
      permitted: [getAll, getById],
      forbidden: [delete_, post, put]
    },
    {
      roles: [Role.OPPORTUNITY_PROVIDER],
      permitted: [getAll, getById],
      forbidden: [delete_, post, put]
    },
    {
      roles: [Role.VOLUNTEER_PROVIDER],
      permitted: [getAll, getById],
      forbidden: [delete_, post, put]
    },
    {
      roles: [Role.ORG_ADMIN],
      permitted: [getAll, getById],
      forbidden: [delete_, post]
      // PUT/Update is handled below separately
    },
    {
      roles: undefined, // Anonymous
      permitted: [getAll, getById],
      forbidden: [delete_, post, put]
    }
  ]

  for (const { roles, permitted, forbidden } of matrix) {
    // Assert each permitted REST call returns a 200 status code
    for (const fn of permitted) {
      const res = await fn(roles)

      t.true(res.statusCode === 200 || res.statusCode === 204, `Failed when running '${fn.name}' for user with roles: ${roles ? roles.join(', ') : 'none'}. Status code was: ${res.statusCode}`)
    }

    // Assert each forbidden REST call returns a 403 status code
    for (const fn of forbidden) {
      const res = await fn(roles)

      // Forbidden
      t.is(res.statusCode, 403, `Failed when running '${fn.name}' for user with roles: ${roles ? roles.join(', ') : 'none'}. Status code was: ${res.statusCode}`)
    }
  }
})

test.serial('Permissions - ORG_ADMIN can update their own organisation', async (t) => {
  // Create new user
  const person = await createPerson()

  // Create an organisation
  const organisation = await createOrganisation()

  // Set our new user as the 'org admin' of the organisation
  await Member.create({
    person,
    organisation,
    status: MemberStatus.ORGADMIN
  })

  // Update fields of our organisation
  const jwtIdToken = createJwtIdToken(person.email)

  const res = await request(server)
    .put(`${endpointUrl}/${organisation._id}`)
    .set('Accept', 'application/json')
    .set('Cookie', [`idToken=${jwtIdToken}`])
    .send({
      name: 'Test org - PUT',
      slug: 'test-organisation',
      category: ['vp']
    })

  t.is(res.status, 200)
  t.is((await Organisation.findOne({ _id: organisation._id })).name, 'Test org - PUT')
})

test.serial('Permissions - ORG_ADMIN cannot update other organisations', async (t) => {
  // Create new user
  const person = await createPerson()

  // Create an organisation
  const organisation1 = await createOrganisation()
  const organisation2 = await createOrganisation()

  // Set our new user as the 'org admin' of organisation1 but not organisation2
  await Member.create({
    person,
    organisation: organisation1,
    status: MemberStatus.ORGADMIN
  })

  // Update fields of our organisation
  const jwtIdToken = createJwtIdToken(person.email)

  // PUT/update organisation2
  const res = await request(server)
    .put(`${endpointUrl}/${organisation2._id}`)
    .set('Accept', 'application/json')
    .set('Cookie', [`idToken=${jwtIdToken}`])
    .send({
      name: 'Organisation2',
      slug: 'test-organisation',
      category: ['vp']
    })

  // Response should be FORBIDDEN
  t.is(res.status, 403)
  // The organisation name should not have updated
  t.is((await Organisation.findOne({ _id: organisation1._id })).name, 'Test org')
})
