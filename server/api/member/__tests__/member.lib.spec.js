import test from 'ava'
import MemoryMongo from '../../../util/test-memory-mongo'
import fixtures from './member.lib.fixtures'
import Member from '../member'
import Person from '../../person/person'
import Organisation from '../../organisation/organisation'
import { MemberStatus } from '../member.constants'
import { Role } from '../../../services/authorize/role'

import {
  findOrgByPersonIdAndCategory,
  getPersonRoles,
  getMemberbyId,
  addMember,
  sortRoles
} from '../member.lib'

test.before('Database start', async (t) => {
  t.context.memMongo = new MemoryMongo()
  await t.context.memMongo.start()
})

test.beforeEach('Load fixtures', async (t) => {
  const [organisations, people] = await Promise.all([
    Organisation.create(fixtures.organisations),
    Person.create(fixtures.people)
  ])

  const members = [
    {
      person: people[0]._id,
      organisation: organisations[0]._id,
      validation: 'orgAdmin',
      status: MemberStatus.ORGADMIN
    },
    {
      person: people[0]._id,
      organisation: organisations[1]._id,
      validation: 'member',
      status: MemberStatus.MEMBER
    },
    {
      person: people[1]._id,
      organisation: organisations[0]._id,
      validation: 'joiner',
      status: MemberStatus.JOINER
    },
    {
      person: people[1]._id,
      organisation: organisations[1]._id,
      validation: 'follower',
      status: MemberStatus.FOLLOWER
    },
    {
      person: people[1]._id,
      organisation: organisations[2]._id,
      validation: 'member',
      status: MemberStatus.MEMBER
    },
    {
      person: people[1]._id,
      organisation: organisations[3]._id,
      validation: 'orgAdmin',
      status: MemberStatus.ORGADMIN
    }
  ]

  t.context.members = await Member.create(members)
  t.context.organisations = organisations
  t.context.people = people
})

test.afterEach.always('Clear fixtures', async (t) => {
  await Promise.all([
    Organisation.deleteMany({}),
    Person.deleteMany({}),
    Member.deleteMany({})
  ])
})

test.after.always('Database stop', async (t) => {
  await t.context.memMongo.stop()
})

test('get member by id fills in some org and person details', async (t) => {
  const member = t.context.members[0]
  const m = await getMemberbyId(member._id)
  // check fields populated out
  t.is(m.person.email, t.context.people[0].email)
  t.is(m.organisation.name, t.context.organisations[0].name)
})

test.serial('add member creates a new member', async (t) => {
  const newMember = {
    person: t.context.people[3]._id,
    organisation: t.context.organisations[3]._id,
    validation: 'test new member',
    status: MemberStatus.FOLLOWER
  }

  const savedMember = await addMember(newMember)

  // member is in database
  t.is(savedMember.status, MemberStatus.FOLLOWER)
  t.is(savedMember.person.email, t.context.people[3].email)
  t.is(savedMember.organisation.name, t.context.organisations[3].name)

  // update the savedmember
  savedMember.status = MemberStatus.VALIDATOR
  const updatedMember = await addMember(savedMember)
  t.is(updatedMember.status, MemberStatus.VALIDATOR)

  // remove the newMember
  await updatedMember.remove()
})

test.serial('Find org by person and category', async (t) => {
  const testData = [
    {
      personId: t.context.people[0]._id,
      category: null,
      expectedOrgId: t.context.organisations[0]._id.str
    },
    {
      personId: t.context.people[0]._id,
      category: 'ap',
      expectedOrgId: t.context.organisations[1]._id.str
    },
    {
      personId: t.context.people[1]._id,
      category: null,
      expectedOrgId: t.context.organisations[3]._id.str
    },
    {
      personId: t.context.people[2]._id,
      category: null,
      expectedOrgId: null
    }
  ]

  t.plan(testData.length)

  for (const testRecord of testData) {
    let orgId = await findOrgByPersonIdAndCategory(testRecord.personId, testRecord.category)

    if (orgId !== null) {
      orgId = orgId.str
    }

    t.is(
      testRecord.expectedOrgId,
      orgId
    )
  }
})

test.serial('role of person with no membership is what is in the person.role field.', async (t) => {
  const person = t.context.people[3]
  const [role, orgAdminFor] = await getPersonRoles(person)
  t.is(role.length, 1)
  t.is(role[0], 'volunteer')
  t.is(orgAdminFor.length, 0)
})

test.serial('role of person with various memberships.', async (t) => {
  const person = t.context.people[1]
  const [role, orgAdminFor] = await getPersonRoles(person)
  t.is(role.length, 4) // ["volunteer","opportunityProvider","orgAdmin","admin"]
  t.is(role[1], 'opportunityProvider') // because org[2] is OP
  t.is(role[3], 'admin') // because org[3] is admin category
  t.is(orgAdminFor.length, 1)
  t.deepEqual(orgAdminFor[0], t.context.organisations[3]._id)
})

test.serial('roles are sorted and deduplicated', t => {
  const desiredOrder = [
    Role.ANON,
    Role.VOLUNTEER_PROVIDER,
    Role.OPPORTUNITY_PROVIDER,
    Role.ACTIVITY_PROVIDER,
    Role.RESOURCE_PROVIDER,
    Role.TESTER,
    Role.ADMIN
  ]

  const mixedRoles = [
    Role.ADMIN,
    Role.VOLUNTEER_PROVIDER,
    Role.OPPORTUNITY_PROVIDER,
    Role.ACTIVITY_PROVIDER,
    Role.TESTER,
    Role.OPPORTUNITY_PROVIDER,
    Role.ANON,
    Role.RESOURCE_PROVIDER,
    Role.OPPORTUNITY_PROVIDER
  ]

  const sortedRoles = sortRoles(mixedRoles)
  t.deepEqual(desiredOrder, sortedRoles)
})
