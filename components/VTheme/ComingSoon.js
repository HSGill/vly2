import styled from 'styled-components'
import { Icon } from 'antd'
import { PBold } from './VTheme'
import { FormattedMessage } from 'react-intl'
const ComingsoonContainer = styled.div`
  display: grid;
  width: 100%;
  height: 100%;
  background-color: #e1e1e1;

  div {
    place-self: center;
  }
`

const ComingSoonGrid = styled.div`
  display: grid;
  grid-template-columns: 4rem 1fr;
  align-self: center;
`

export function ComingSoon ({ children }) {
  return (
    <ComingsoonContainer>
      <ComingSoonGrid>
        <Icon spin style={{ fontSize: '40px', color: '#333' }} type='deployment-unit' />
        <div>
          <PBold>
            <FormattedMessage 
              id='comingSoon' 
              description='title for coming soon component'
              defaultMessage='Needs Work'
            />
          </PBold>
          <p>{children}</p>
        </div>
      </ComingSoonGrid>
    </ComingsoonContainer>
  )
}

export default ComingSoon
